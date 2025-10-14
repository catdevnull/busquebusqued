import { useState } from "react";
import TweetEmbed from "./TweetEmbed";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Tweet Search
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Search indexed tweets and see scored results.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
              placeholder="Enter your search query..."
              className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              disabled={loading}
              aria-label="Search query"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center justify-center px-5 py-2 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                  Searching...
                </span>
              ) : (
                "Search"
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 rounded-xl border border-red-300/60 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">⚠️</span>
              <div>
                <p className="font-medium">Search error</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Results</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                {results.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 backdrop-blur p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Search Score Badge */}
                  <div className="flex justify-end">
                    <span className="text-[10px] sm:text-xs font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full border border-blue-200/60 dark:border-blue-900/60">
                      Score: {result.final_score?.toFixed(3) || "N/A"}
                    </span>
                  </div>

                  {/* Tweet Embed */}
                  <TweetEmbed tweetId={result.tweet_id} className="shadow-sm" />

                  {/* Additional Info */}
                  <div className="mt-3 flex gap-2 justify-center">
                    {result.is_retweet && (
                      <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                        🔁 Retweet
                      </span>
                    )}
                    {result.has_media && (
                      <span className="px-2.5 py-1 text-xs rounded-full bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border border-green-200/60 dark:border-green-900/60">
                        🖼️ Media
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 mb-4">
              🔎
            </div>
            <p className="text-lg font-medium">No results</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              No results found for "{query}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
