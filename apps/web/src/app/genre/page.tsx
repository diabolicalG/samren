'use client';

import { useState } from 'react';
import { useGenres, useAnimeList } from '@samren/hooks';
import { AnimeGrid, GenreFilter } from '@samren/ui';

export default function GenresPage() {
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data: genresData, isLoading: genresLoading } = useGenres();
  const { data, isLoading, error } = useAnimeList({
    genres: selectedGenre,
    page,
    limit: 20,
  });

  const genres = genresData?.data ?? [];
  const animes = data?.data?.items ?? [];

  const handleGenreSelect = (genreId: string | undefined) => {
    setSelectedGenre(genreId);
    setPage(1);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Genres</h1>

      {genresLoading ? (
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse bg-gray-800 rounded-full" />
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <GenreFilter
            genres={genres}
            selectedGenre={selectedGenre}
            onSelect={handleGenreSelect}
          />
        </div>
      )}

      {selectedGenre ? (
        <AnimeGrid
          animes={animes}
          isLoading={isLoading}
          error={error}
          currentPage={page}
          hasNext={data?.data?.hasNext ?? false}
          onPageChange={setPage}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {animes.map((anime) => (
            <div key={anime.id} className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
              <img
                src={anime.coverImage}
                alt={anime.title}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
