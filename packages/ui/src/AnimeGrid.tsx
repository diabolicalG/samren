'use client';

import Link from 'next/link';
import type { Anime } from '@samren/types';
import { AnimeCard, RatingBadge } from './AnimeCard';

export function AnimeGrid({
  animes,
  isLoading,
  error,
  currentPage,
  hasNext,
  onPageChange,
}: {
  animes: Anime[];
  isLoading?: boolean;
  error?: unknown;
  currentPage: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
}) {
  if (error) {
    return (
      <div className="p-6 text-red-500">
        Something went wrong loading anime. Please try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-lg bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  if (animes.length === 0) {
    return <div className="p-6 text-subtle">No anime found.</div>;
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {animes.map((anime) => (
          <Link href={`/anime/${anime.id}`} key={anime.id} className="block relative">
            <AnimeCard anime={anime} />
            {anime.rating > 0 && (
              <div className="absolute top-2 right-2">
                <RatingBadge rating={anime.rating} maxRating={10} size="sm" />
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 text-sm rounded-md bg-surface text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-border transition-colors"
        >
          Previous
        </button>
        <span className="text-sm text-subtle">Page {currentPage}</span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className="px-3 py-1.5 text-sm rounded-md bg-surface text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-border transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
