import { useState } from "react";
import useSWR from "swr";
import TweetEmbed from "./TweetEmbed";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Use SWR for data fetching
  const {
    data: apiResponse,
    error,
    isLoading,
  } = useSWR(
    searchQuery ? `/api/search?q=${encodeURIComponent(searchQuery)}` : null,
    (url: string) => fetch(url).then((res) => res.json())
  );

  // Fetch headings for example search terms
  const {
    data: headings,
    error: headingsError,
    isLoading: headingsLoading,
  } = useSWR("/api/headings", (url: string) =>
    fetch(url).then((res) => res.json())
  );

  // Extract results and handle API errors
  const results = apiResponse?.error ? [] : apiResponse?.results || [];
  const apiError = apiResponse?.error;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchQuery(query);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            BusqueBusqued
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Busca entre todos los tweets de Carlos Busqued.
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
              disabled={isLoading}
              aria-label="Search query"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="inline-flex items-center justify-center px-5 py-2 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
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

        {(error || apiError) && (
          <div className="mb-6 rounded-xl border border-red-300/60 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">⚠️</span>
              <div>
                <p className="font-medium">Search error</p>
                <p className="text-sm opacity-90">
                  {error?.message || apiError}
                </p>
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
              {results.map((result: any, index: number) => (
                <div key={index} className="backdrop-blur">
                  {/* Search Score Badge */}
                  {/* <div className="flex justify-end">
                    <span className="text-[10px] sm:text-xs font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full border border-blue-200/60 dark:border-blue-900/60">
                      Score: {result.final_score?.toFixed(3) || "N/A"}
                    </span>
                  </div> */}

                  {/* Tweet Embed */}
                  <TweetEmbed tweetId={result.tweet_id} className="shadow-sm" />

                  {/* Additional Info */}
                  <div className="mt-3 flex gap-2 justify-center">
                    {result.is_retweet && (
                      <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                        🔁 Retweet
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && results.length === 0 && searchQuery && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 mb-4">
              🔎
            </div>
            <p className="text-lg font-medium">No results</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              No results found for "{searchQuery}"
            </p>
          </div>
        )}

        {!isLoading && results.length === 0 && !searchQuery && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 mb-4">
              🐦
            </div>
            <p className="text-lg font-medium">Welcome to Tweet Search</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
              Search through indexed tweets to find what you're looking for
            </p>

            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Try searching for:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {headingsLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <span className="h-4 w-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                    Loading examples...
                  </div>
                ) : headingsError ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Unable to load examples
                  </div>
                ) : headings && headings.length > 0 ? (
                  headings.slice(0, 10).map((heading: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(heading.text);
                        setSearchQuery(heading.text);
                      }}
                      className="px-3 py-1.5 text-xs rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                    >
                      {heading.text}
                    </button>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    No examples available
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
