import { serve, sql } from "bun";
import index from "./frontend/index.html";
import { searchTweets } from "./index";
import { extractHeadings, scrapeHeadings } from "./lib/scraper";

const headings = scrapeHeadings("https://lapoliticaonline.com/");

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitBuckets = new Map<string, number[]>();

// Basic in-memory per-client rate limiting for search requests
function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "local";
}

function checkRateLimit(clientId: string, now: number): number {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = rateLimitBuckets.get(clientId) ?? [];
  const recent = timestamps.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(clientId, recent);
    const retryAfterMs = (recent[0] ?? now) + RATE_LIMIT_WINDOW_MS - now;
    return Math.max(1, Math.ceil(retryAfterMs / 1000));
  }

  recent.push(now);
  rateLimitBuckets.set(clientId, recent);
  return 0;
}

serve({
  port: 3000,
  routes: {
    "/*": index,
    "/api/headings": {
      GET: async (req) => {
        return new Response(JSON.stringify(await headings), { status: 200 });
      },
    },
    "/api/search": {
      GET: async (req) => {
        try {
          const now = Date.now();
          const clientId = getClientIdentifier(req);
          const retryAfterSeconds = checkRateLimit(clientId, now);

          if (retryAfterSeconds > 0) {
            return new Response(
              JSON.stringify({ error: "Too many requests, please slow down." }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": retryAfterSeconds.toString(),
                },
              }
            );
          }

          const url = new URL(req.url);
          const query = url.searchParams.get("q");
          const k = parseInt(url.searchParams.get("k") || "40", 10);

          if (!query) {
            return new Response(
              JSON.stringify({ error: "Missing query parameter 'q'" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          const results = await searchTweets(sql, query, k);

          return new Response(
            JSON.stringify({
              query,
              results: results.map((r) => ({
                tweet_id: r.tweet_id,
                created_at: r.created_at,
                text: r.text,
                is_retweet: r.is_retweet,
                has_media: r.has_media,
                final_score: r.final_score,
                fts_rank: r.fts_rank,
                semantic_sim: r.semantic_sim,
              })),
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("Search error:", error);
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
    "/api/tweet/:tweetId": {
      GET: async (req) => {
        try {
          const url = new URL(req.url);
          const tweetId = url.pathname.split("/").pop();

          if (!tweetId) {
            return new Response(JSON.stringify({ error: "Missing tweet ID" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Proxy request to FxEmbed API
          const fxResponse = await fetch(
            `https://api.fxtwitter.com/status/${tweetId}`,
            {
              headers: {
                "User-Agent": "BusqueBusqued/1.0",
              },
            }
          );

          if (!fxResponse.ok) {
            return new Response(
              JSON.stringify({
                code: fxResponse.status,
                message: fxResponse.status === 404 ? "NOT_FOUND" : "API_FAIL",
              }),
              {
                status: fxResponse.status,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          const tweetData = await fxResponse.json();

          return new Response(JSON.stringify(tweetData), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Tweet fetch error:", error);
          return new Response(
            JSON.stringify({
              code: 500,
              message: "API_FAIL",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
  fetch(req) {
    return new Response("Not Found", { status: 404 });
  },
});

console.log("Server is running on port http://localhost:3000");
