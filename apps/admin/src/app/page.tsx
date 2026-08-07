'use client';

import { useTopAnime, useAnimeList, useGenres } from '@samren/hooks';
import { RatingBadge } from '@samren/ui';
import Link from 'next/link';

export default function AdminDashboard() {
  const { data: topData, isLoading: topLoading } = useTopAnime({ page: 1, limit: 10 });
  const { data: ongoingData, isLoading: ongoingLoading } = useAnimeList({
    status: 'airing',
    page: 1,
    limit: 10,
  });
  const { data: genresData } = useGenres();

  const topAnime = topData?.data?.items ?? [];
  const ongoingAnime = ongoingData?.data?.items ?? [];
  const genres = genresData?.data ?? [];

  const totalAnime = topData?.data?.total ?? 0;
  const totalGenres = genres.length;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-300">Total Anime</h2>
          <p className="text-2xl mt-2">{totalAnime}</p>
        </div>
        <div className="bg-card p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-300">Ongoing Airing</h2>
          <p className="text-2xl mt-2">{ongoingAnime.length}</p>
        </div>
        <div className="bg-card p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-300">Genres</h2>
          <p className="text-2xl mt-2">{totalGenres}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Top Anime</h2>
          {topLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse bg-gray-800 rounded" />
              ))}
            </div>
          ) : topAnime.length === 0 ? (
            <p className="text-gray-400">No top anime available.</p>
          ) : (
            <div className="space-y-2">
              {topAnime.map((anime) => (
                <Link
                  href={`/anime/${anime.id}`}
                  key={anime.id}
                  className="flex items-center gap-3 block hover:bg-gray-800 rounded p-2 transition-colors"
                >
                  <div className="w-12 h-16 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                    <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 truncate">
                    <p className="font-medium text-white truncate">{anime.title}</p>
                    <p className="text-xs text-gray-400">{anime.year} • {anime.type}</p>
                  </div>
                  <RatingBadge rating={anime.rating} maxRating={10} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Currently Airing</h2>
          {ongoingLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse bg-gray-800 rounded" />
              ))}
            </div>
          ) : ongoingAnime.length === 0 ? (
            <p className="text-gray-400">No ongoing anime available.</p>
          ) : (
            <div className="space-y-2">
              {ongoingAnime.map((anime) => (
                <Link
                  href={`/anime/${anime.id}`}
                  key={anime.id}
                  className="flex items-center gap-3 block hover:bg-gray-800 rounded p-2 transition-colors"
                >
                  <div className="w-12 h-16 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                    <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 truncate">
                    <p className="font-medium text-white truncate">{anime.title}</p>
                    <p className="text-xs text-gray-400">{anime.year} • {anime.type}</p>
                  </div>
                  <RatingBadge rating={anime.rating} maxRating={10} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
