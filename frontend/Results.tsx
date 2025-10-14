import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import TweetEmbed from "./TweetEmbed";

export default function Results() {
  const { query } = useParams<{ query: string }>();
  const decodedQuery = query ? decodeURIComponent(query) : "";

  // Use SWR for data fetching
  const {
    data: apiResponse,
    error,
    isLoading,
  } = useSWR(
    decodedQuery ? `/api/search?q=${encodeURIComponent(decodedQuery)}` : null,
    (url: string) => fetch(url).then((res) => res.json())
  );

  // Extract results and handle API errors
  const results = apiResponse?.error ? [] : apiResponse?.results || [];
  const apiError = apiResponse?.error;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            ← Nueva búsqueda
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            BusqueBusqued
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Resultados para: "{decodedQuery}"
          </p>
        </div>

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

        {isLoading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 mb-4">
              <span className="h-6 w-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-lg font-medium">Buscando...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Buscando resultados para "{decodedQuery}"
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((result: any, index: number) => (
                <div key={index} className="backdrop-blur">
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

        {!isLoading && results.length === 0 && decodedQuery && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 mb-4">
              🔎
            </div>
            <p className="text-lg font-medium">No se encontraron resultados</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              No se encontraron resultados para "{decodedQuery}"
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center mt-4 px-4 py-2 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm hover:from-blue-700 hover:to-indigo-700 transition-colors"
            >
              Nueva búsqueda
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
