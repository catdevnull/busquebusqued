#!/usr/bin/env bun
import { sql, SQL } from "bun";
import fs from "node:fs";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

type Db = SQL;

type IngestRow = {
  tweet_id: string;
  created_at: Date;
  text: string;
  lang?: string | null;
  is_retweet?: boolean;
  has_media?: boolean;
};

type Candidate = {
  i: number;
  tweet_id: string;
  created_at: string; // ISO string for prompt
  text: string;
  is_retweet: boolean;
  has_media: boolean;
  fts_rank: number;
  semantic_sim?: number;
};

type RerankResult = { i: number; score: number }[];
type RankedCandidate = Candidate & { final_score: number };

type RawTweet = Record<string, unknown> & {
  full_text: string;
  text?: string;
  id_str: string;
  tweet_created_at?: string;
  retweeted_status?: unknown;
  type?: unknown;
  entities?: unknown;
  lang: string;
};

// --- CLI entrypoint ---
(async () => {
  const [, , cmd, ...rest] = Bun.argv;

  switch (cmd) {
    case "init": {
      await ensureSchema(sql);
      console.log("Init complete.");
      break;
    }
    case "ingest": {
      const file = rest[0];
      if (!file) {
        console.error("Usage: bun run index.ts ingest <tweets.jsonl>");
        process.exit(1);
      }
      await ensureSchema(sql);
      await ingestJsonl(sql, file);
      break;
    }
    case "search": {
      const parsed = parseArgs({
        args: rest,
        options: {
          k: { type: "string", short: "k" },
        },
        allowPositionals: true,
      });
      const query = parsed.positionals.join(" ").trim();
      if (!query) {
        console.error('Usage: bun run index.ts search "query text" [--k=10]');
        process.exit(1);
      }
      const k = parsed.values.k ? parseInt(parsed.values.k, 10) : 10;

      const candidates = await fetchHybridCandidates(sql, query, 150);

      if (candidates.length === 0) {
        console.log("No results.");
        process.exit(0);
      }
      const rerank = await rerankCandidates(query, candidates);
      const top = computeFinalRanking(candidates, rerank, k);
      for (const r of top) {
        console.log(
          `${r.created_at.slice(0, 10)} | ${r.final_score.toFixed(3)} | ${
            r.tweet_id
          } | ${r.text}`
        );
      }
      break;
    }
    default: {
      console.error(
        "Usage: bun run index.ts <init|ingest|search> (see README for details)"
      );
      process.exit(1);
    }
  }
})();

// --- Schema & Init ---
async function ensureSchema(db: Db) {
  await db`CREATE EXTENSION IF NOT EXISTS unaccent`;
  await db`CREATE EXTENSION IF NOT EXISTS vector`;

  await db`
    CREATE TABLE IF NOT EXISTS tweets (
      tweet_id BIGINT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      text TEXT NOT NULL,
      lang TEXT,
      is_retweet BOOLEAN DEFAULT FALSE,
      has_media BOOLEAN DEFAULT FALSE,
      tsv tsvector,
      emb vector(1536)
    )
  `;

  await db`
    CREATE OR REPLACE FUNCTION tweets_tsv_update() RETURNS trigger AS $$
    BEGIN
      NEW.tsv := to_tsvector('spanish', unaccent(lower(coalesce(NEW.text, ''))));
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql
  `;

  await db`DROP TRIGGER IF EXISTS tweets_tsv_update_trg ON tweets`;

  await db`
    CREATE TRIGGER tweets_tsv_update_trg
    BEFORE INSERT OR UPDATE OF text
    ON tweets FOR EACH ROW EXECUTE FUNCTION tweets_tsv_update()
  `;

  await db`CREATE INDEX IF NOT EXISTS tweets_tsv_idx ON tweets USING GIN (tsv)`;
  await db`CREATE INDEX IF NOT EXISTS tweets_created_at_idx ON tweets (created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS tweets_emb_idx ON tweets USING hnsw (emb vector_cosine_ops)`;
}

// --- Ingest JSONL ---
async function ingestJsonl(db: Db, filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const batchSize = 5000;
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let batch: IngestRow[] = [];
  let total = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as RawTweet;
      if (!obj.full_text || !obj.id_str) continue;

      if (!obj.tweet_created_at) continue;
      const createdAt = new Date(obj.tweet_created_at);
      if (Number.isNaN(createdAt.getTime())) continue;

      const row: IngestRow = {
        tweet_id: obj.id_str,
        created_at: createdAt,
        text: obj.full_text,
        lang: obj.lang ?? null,
        is_retweet: Boolean(obj.retweeted_status),
        has_media: extractHasMedia(obj.entities),
      };
      batch.push(row);
      if (batch.length >= batchSize) {
        const inserted = await upsertTweets(db, batch);
        total += inserted;
        batch = [];
        console.log(`Ingested ${total} tweets...`);
      }
    } catch (err) {
      console.error(err);
    }
  }
  if (batch.length > 0) {
    const inserted = await upsertTweets(db, batch);
    total += inserted;
  }
  console.log(`Ingest complete. Total rows processed: ${total}`);
}

async function upsertTweets(db: Db, rows: IngestRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const texts = rows.map((r) => r.text);

  const embeddings = await computeEmbeddingsBatch(texts);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const emb = embeddings[i]!;

    await db`
      INSERT INTO tweets (tweet_id, created_at, text, lang, is_retweet, has_media, emb)
      VALUES (
        ${row.tweet_id},
        ${row.created_at},
        ${row.text},
        ${row.lang},
        ${row.is_retweet},
        ${row.has_media},
        ${JSON.stringify(emb)}::vector
      )
      ON CONFLICT (tweet_id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        text = EXCLUDED.text,
        lang = EXCLUDED.lang,
        is_retweet = EXCLUDED.is_retweet,
        has_media = EXCLUDED.has_media,
        emb = EXCLUDED.emb
    `;
  }

  return rows.length;
}

// --- FTS Search (candidates) ---
type FtsRow = {
  tweet_id: string;
  created_at: string | Date;
  text: string;
  is_retweet: boolean | null;
  has_media: boolean | null;
  fts_rank: number | null;
};

async function fetchFtsCandidates(
  db: Db,
  userQuery: string,
  limit: number
): Promise<Candidate[]> {
  const result = await db`
    WITH q AS (
      SELECT websearch_to_tsquery('spanish', ${userQuery}) AS tsq
    )
    SELECT 
      tweet_id::text AS tweet_id,
      created_at,
      text,
      coalesce(is_retweet, false) as is_retweet,
      coalesce(has_media, false) as has_media,
      ts_rank(tsv, q.tsq) AS fts_rank
    FROM tweets, q
    WHERE tsv @@ q.tsq
    ORDER BY fts_rank DESC, created_at ASC
    LIMIT ${limit}
  `;
  const rows = result as FtsRow[];
  return rows.map((row, i) => ({
    i,
    tweet_id: row.tweet_id,
    created_at: new Date(row.created_at).toISOString(),
    text: row.text,
    is_retweet: Boolean(row.is_retweet),
    has_media: Boolean(row.has_media),
    fts_rank:
      typeof row.fts_rank === "number" && Number.isFinite(row.fts_rank)
        ? row.fts_rank
        : 0,
  }));
}

// --- Rerank via OpenRouter ---
async function rerankCandidates(
  query: string,
  candidates: Candidate[]
): Promise<RerankResult> {
  const model = Bun.env.RERANK_MODEL ?? "gpt-5-mini";

  const compactCandidates = candidates.map((c) => ({
    i: c.i,
    id: c.tweet_id,
    created_at: c.created_at,
    text: truncate(c.text, 300),
  }));

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Bun.env.OPENROUTER_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You rate tweets strictly 0..6 for how well they describe or entail the given headline. Return only compact JSON array of {i, score}. No commentary.",
        },
        {
          role: "user",
          content:
            `Headline: ${query}\n\nCandidates (JSONL):\n` +
            compactCandidates.map((o) => JSON.stringify(o)).join("\n"),
        },
      ],
      temperature: 0,
      max_tokens: 600,
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `OpenRouter request failed: ${resp.status} ${resp.statusText}`
    );
  }

  const data: any = await resp.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  return safeParseRerankJson(content);
}

function safeParseRerankJson(s: string): RerankResult {
  const normalize = (a: any[]): RerankResult =>
    a
      .map((x) => ({ i: Number(x.i), score: clampInt(Number(x.score), 0, 6) }))
      .filter((x) => Number.isFinite(x.i) && Number.isFinite(x.score));

  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) return normalize(j);
  } catch {}
  const m = s.match(/\[([\s\S]*?)\]/);
  if (m) {
    const j = JSON.parse(m[0]!);
    if (Array.isArray(j)) return normalize(j);
  }
  throw new Error("Failed to parse rerank JSON");
}

// --- Final Ranking & Output ---
function computeFinalRanking(
  candidates: Candidate[],
  rerank: RerankResult,
  k: number
): RankedCandidate[] {
  const iToLlmScore = new Map<number, number>();
  for (const { i, score } of rerank) {
    iToLlmScore.set(i, score);
  }

  const maxFts = Math.max(...candidates.map((c) => c.fts_rank), 0.000001);
  const maxSemSim = Math.max(
    ...candidates.map((c) => c.semantic_sim ?? 0),
    0.000001
  );
  const now = Date.now();
  const logAges = candidates.map((c) =>
    Math.log1p(Math.max(0, (now - new Date(c.created_at).getTime()) / 86400000))
  );
  const minLogAge = Math.min(...logAges);
  const maxLogAge = Math.max(...logAges);
  const ageDen = Math.max(1e-6, maxLogAge - minLogAge);

  const results: RankedCandidate[] = candidates.map((c, idx) => {
    const llmNorm = clampInt(iToLlmScore.get(c.i) ?? 0, 0, 6) / 6;
    const ftsNorm = c.fts_rank / maxFts;
    const semNorm = (c.semantic_sim ?? 0) / maxSemSim;
    const ageNorm = (logAges[idx]! - minLogAge) / ageDen;

    let finalScore =
      0.6 * llmNorm + 0.15 * ftsNorm + 0.15 * semNorm + 0.1 * ageNorm;
    if (c.is_retweet) finalScore -= 0.03;

    return { ...c, final_score: finalScore };
  });

  // Deduplicate near-identical texts (keep highest score)
  const seen = new Map<string, { idx: number; score: number }>();
  const deduped: typeof results = [];
  for (const r of results) {
    const key = normalizeForDedup(r.text);
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, { idx: deduped.length, score: r.final_score });
      deduped.push(r);
    } else if (r.final_score > prev.score) {
      deduped[prev.idx] = r;
      seen.set(key, { idx: prev.idx, score: r.final_score });
    }
  }

  deduped.sort((a, b) => b.final_score - a.final_score);
  return deduped.slice(0, k);
}

// --- Embeddings (OpenAI) ---
async function computeEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const batchSize = 3000;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Bun.env.OPENAI_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-large",
        input: batch,
        encoding_format: "float",
      }),
    });

    if (!resp.ok) {
      throw new Error(
        `OpenAI embeddings failed: ${resp.status} ${resp.statusText}`
      );
    }

    const data: any = await resp.json();
    const embeddings = data.data.map((d: any) => d.embedding as number[]);
    results.push(...embeddings);
  }

  return results;
}

// --- Hybrid Search (FTS + ANN) ---
type AnnRow = {
  tweet_id: string;
  created_at: string | Date;
  text: string;
  is_retweet: boolean | null;
  has_media: boolean | null;
  semantic_sim: number | null;
};

async function fetchHybridCandidates(
  db: Db,
  userQuery: string,
  limit: number
): Promise<Candidate[]> {
  const ftsCandidates = await fetchFtsCandidates(db, userQuery, limit);
  const [queryEmb] = await computeEmbeddingsBatch([userQuery]);

  const annResult = await db`
    SELECT 
      tweet_id::text AS tweet_id,
      created_at,
      text,
      coalesce(is_retweet, false) as is_retweet,
      coalesce(has_media, false) as has_media,
      1 - (emb <=> ${JSON.stringify(queryEmb)}::vector) AS semantic_sim
    FROM tweets
    WHERE emb IS NOT NULL
    ORDER BY emb <=> ${JSON.stringify(queryEmb)}::vector
    LIMIT ${limit}
  `;

  const annRows = annResult as AnnRow[];
  const annCandidates: Candidate[] = annRows.map((row, i) => ({
    i: ftsCandidates.length + i,
    tweet_id: row.tweet_id,
    created_at: new Date(row.created_at).toISOString(),
    text: row.text,
    is_retweet: Boolean(row.is_retweet),
    has_media: Boolean(row.has_media),
    fts_rank: 0,
    semantic_sim:
      typeof row.semantic_sim === "number" && Number.isFinite(row.semantic_sim)
        ? row.semantic_sim
        : 0,
  }));

  // Union and dedupe by tweet_id
  const seen = new Set<string>();
  const combined: Candidate[] = [];

  for (const c of ftsCandidates) {
    if (!seen.has(c.tweet_id)) {
      seen.add(c.tweet_id);
      combined.push({ ...c, semantic_sim: 0 });
    }
  }

  for (const c of annCandidates) {
    if (!seen.has(c.tweet_id)) {
      seen.add(c.tweet_id);
      combined.push(c);
    } else {
      const existing = combined.find((x) => x.tweet_id === c.tweet_id);
      if (existing) {
        existing.semantic_sim = c.semantic_sim;
      }
    }
  }

  return combined.map((c, i) => ({ ...c, i }));
}

// --- Utils ---
const truncate = (s: string, n: number) =>
  s.length <= n ? s : s.slice(0, n - 1) + "…";

const clampInt = (x: number, min: number, max: number) =>
  Number.isFinite(x) ? Math.max(min, Math.min(max, Math.round(x))) : min;

const normalizeForDedup = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();

const extractHasMedia = (entities: unknown) =>
  Array.isArray((entities as { media?: unknown })?.media) &&
  (entities as { media: unknown[] }).media.length > 0;
