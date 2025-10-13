0. Objectives & constraints

Goal: Given a short query (e.g., a news headline), surface older tweets from one prolific account that describe or entail the query (“Simpsons effect”).

Infra: Single Bun TypeScript script. One Postgres instance. No extra services. LLM via OpenRouter (rerank only).

Assumption: OpenRouter for chat/rerank (use gpt-5-mini for now); embeddings come later (OpenAI/Voyage/Cohere/Ollama) if needed. don't implement embeddings for now

1. CLI surface (single script)

init → create tables, indexes, triggers; detect embedding dimension only if an embeddings provider is configured.

ingest <tweets.jsonl> → batch-load tweets, normalize, (optionally) embed & upsert. See carlosbusqued.jsonl.

search "<headline>" → FTS candidate fetch → LLM rerank → final ranking with small “older is spookier” boost.

2. Data model (one table)

Store exactly what you need for ranking and display:

tweet_id (PK), created_at, text, lang (optional).

tsv (FTS vector).

emb (vector) — only if embeddings are configured.

Optional derived flags: is_retweet, has_media (for filters/exclusions later).

3. Ingestion (source → normalized rows)

Source: JSONL with id, text, created_at (ISO).

Normalization:

Lowercase for FTS; keep hashtags/emojis; drop most @mentions unless semantically important.

Optionally stitch one level of thread context (root + tweet) into text tail (flag somewhere if you do).

Persistence: Upsert rows; the tsv column is populated by a trigger (unaccent + language config).

Embeddings (optional): If an embeddings provider is configured, compute once at ingest time and store in emb.

4. Search pipeline (FTS-only MVP)

Input: a short, news-y query string.

FTS candidate set: Use websearch_to_tsquery over tsv to fetch ~150 top candidates (BM25 ranking).

LLM rerank (OpenRouter):

Send a single batched message with the query and the candidate tweets.

Ask for a strict 0–6 score per candidate: “Does this tweet describe or entail the headline?”

Keep the output as compact JSON; truncate tweet text to ~200 chars to control tokens.

Final score & ordering:

Combine: 0.65 _ LLM_score_norm + 0.25 _ FTS_norm + 0.10 \* age_boost.

Age boost: small log-scaled boost favoring older tweets (the “prophetic” feel).

Deduplicate near-identical texts; lightly penalize RTs/quotes if you kept them.

Output: print top-k with date, final score, and text.

This MVP needs only Postgres + OpenRouter and already feels good for headlines.

5. Optional hybrid upgrade (when you add embeddings)

Provider: Pick one (OpenAI, Voyage, Cohere, or local Ollama). Keep OpenRouter for reranking.

Index: Add pgvector extension and a single HNSW index on emb.

Search changes:

Embed the query with the same provider.

Fetch ~150 top FTS + ~150 top ANN (semantic) candidates; union + dedupe (~180 total).

Reuse the same LLM reranker and final scoring. Add a small semantic-similarity feature to the score.

6. Reranker prompt design (stable & cheap)

User message: Include the one-line query, then line-delimited candidate JSON objects with i, id, created_at, text (truncated).

Token control: Cap candidates and truncate text; no chain of thought or explanations requested.

7. Quality controls & heuristics

Specificity filter: Down-weight extremely short/generic tweets.

Diversity: Simple near-duplicate suppression (similar text → keep only the highest-scoring).

Temporal logic: Optionally allow before:YYYY or “exclude last 12 months” flags later; default to mild age boost.

Language mixing: If your corpus is bilingual, keep FTS config to 'simple' or keep 'spanish' + unaccent. Headlines are often spanish; this is usually fine.

8. Minimal acceptance tests (manual or tiny fixtures)

Use a tiny JSONL (200–500 tweets) plus a few headline queries:

Precision sanity: Top 3 contain obviously relevant matches.

Temporal feel: Older relevant tweets outrank newer near-duplicates.

Robustness: Empty/rare queries return something reasonable or a clear “no results” message.
