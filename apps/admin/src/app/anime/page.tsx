'use client';

import { useState } from 'react';
import { useAnimeList } from '@samren/hooks';
import { AnimeGrid, SearchBar } from '@samren/ui';

export default function AdminAnimePage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAnimeList({ q: query, page, limit: 20 });

  const animes = data?.data?.items ?? [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Anime</h1>
      <div className="mb-4 max-w-md">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSearch={() => setPage(1)}
          placeholder="Search anime..."
        />
      </div>
      <AnimeGrid
        animes={animes}
        isLoading={isLoading}
        error={error}
        currentPage={page}
        hasNext={data?.data?.hasNext ?? false}
        onPageChange={setPage}
      />
    </div>
  );
}
