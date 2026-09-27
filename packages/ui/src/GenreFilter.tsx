'use client';

import type { Genre } from '@samren/types';

export function GenreFilter({
  genres,
  selectedGenre,
  onSelect,
}: {
  genres: Genre[];
  selectedGenre: string | undefined;
  onSelect: (genreId: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(undefined)}
        className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
          !selectedGenre ? 'bg-accent text-white' : 'bg-surface text-subtle hover:text-white'
        }`}
      >
        All
      </button>
      {genres.map((genre) => (
        <button
          key={genre.id}
          onClick={() => onSelect(genre.id)}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            selectedGenre === genre.id
              ? 'bg-accent text-white'
              : 'bg-surface text-subtle hover:text-white'
          }`}
        >
          {genre.name}
        </button>
      ))}
    </div>
  );
}
