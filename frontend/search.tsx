import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Fetch headings for example search terms
  const {
    data: headings,
    error: headingsError,
    isLoading: headingsLoading,
  } = useSWR("/api/headings", (url: string) =>
    fetch(url).then((res) => res.json())
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search/${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white dark:from-stone-900 dark:to-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-700 to-yellow-800">
            BusqueBusqued
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Buscá entre todos los tweets de Carlos Busqued.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
              placeholder="Consultá el oráculo..."
              className="flex-1 px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 placeholder:text-stone-400"
              aria-label="Búsqueda"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="inline-flex items-center justify-center px-5 py-2 rounded-xl font-medium text-white bg-gradient-to-r from-amber-700 to-yellow-800 shadow-sm hover:from-amber-800 hover:to-yellow-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Buscar
            </button>
          </div>
        </form>

        {!query && (
          <div className="text-center py-16">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
                Probá buscando alguno de estos titulares de La Politica Online:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {headingsLoading ? (
                  <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                    <span className="h-4 w-4 border-2 border-stone-300 border-t-transparent rounded-full animate-spin" />
                    Cargando ejemplos...
                  </div>
                ) : headingsError ? (
                  <div className="text-sm text-stone-500 dark:text-stone-400">
                    No se pudieron cargar los ejemplos
                  </div>
                ) : headings && headings.length > 0 ? (
                  headings.slice(0, 10).map((heading: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(heading.text);
                        navigate(`/search/${encodeURIComponent(heading.text)}`);
                      }}
                      className="px-3 py-1.5 text-xs rounded-full bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                    >
                      {heading.text}
                    </button>
                  ))
                ) : (
                  <div className="text-sm text-stone-500 dark:text-stone-400">
                    No hay ejemplos disponibles
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
