'use client';

import { useGenres } from '@samren/hooks';

export default function AdminGenresPage() {
  const { data, isLoading, error } = useGenres();
  const genres = data?.data ?? [];

  if (error) {
    return <div className="p-6 text-red-500">Error loading genres.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Genres</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse bg-gray-800 rounded" />
          ))}
        </div>
      ) : genres.length === 0 ? (
        <p className="text-gray-400">No genres available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {genres.map((genre) => (
            <div key={genre.id} className="bg-card p-3 rounded-lg">
              <p className="font-medium text-white">{genre.name}</p>
              {genre.description && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{genre.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
