'use client';

import { useState } from 'react';
import { useAnimeList } from '@samren/hooks';
import { AnimeGrid } from '@samren/ui';

export default function CompletedAnimePage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAnimeList({
    status: 'completed',
    page,
    limit: 20,
  });

  const animes = data?.data?.items ?? [];

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
