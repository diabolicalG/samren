'use client';

import { useState } from 'react';
import { useSearch } from '@samren/hooks';
import { SearchBar, AnimeCard, RatingBadge } from '@samren/ui';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const { data, isLoading, error } = useSearch(submittedQuery, {
    enabled: submittedQuery.length > 1,
  });

  const results = data?.data?.animes ?? [];

  const handleSearch = (q: string) => {
    if (q.trim().length > 1) {
      setSubmittedQuery(q.trim());
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Search</h1>
      <div className="mb-4">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSearch={handleSearch}
          placeholder="Search anime..."
        />
      </div>

      {error && <p className="text-red-500">Error searching anime.</p>}

      {submittedQuery && (
        <p className="text-sm text-gray-400 mb-4">
          {isLoading ? 'Searching...' : `${data?.data?.total ?? 0} results for "${submittedQuery}"`}
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg overflow-hidden bg-gray-800 aspect-[2/3]" />
          ))}
        </div>
      ) : results.length === 0 && submittedQuery ? (
        <p className="text-gray-400">No anime found. Try a different search.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {results.map((anime) => (
                <Link href={`/anime/${anime.id}`} key={anime.id} className="block">
                  <div className="relative">
                    <AnimeCard anime={anime} />
                    {anime.rating > 0 && (
                      <div className="absolute top-2 right-2">
                        <RatingBadge rating={anime.rating} maxRating={10} size="sm" />
                      </div>
                    )}
                  </div>
                </Link>
              ))}
        </div>
      )}
    </div>
  );
}
