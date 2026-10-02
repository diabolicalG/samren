'use client';

import { useState } from 'react';
import { useAnimeList } from '@samren/hooks';
import { AnimeGrid } from '@samren/ui';

export default function HomePage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAnimeList({ page, limit: 20 });

  const animes = data?.data?.items ?? [];

  // Keep the home route intentionally simple: the API gateway now owns the
  // provider fallback, so the browser has one stable contract.

  return (
    <AnimeGrid
      animes={animes}
      isLoading={isLoading}
      error={error}
      currentPage={page}
      hasNext={data?.data?.hasNext ?? false}
      onPageChange={setPage}
    />
  );
}
