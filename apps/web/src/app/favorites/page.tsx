'use client';

import { useFavorites } from '@samren/hooks';
import { AnimeCard, RatingBadge } from '@samren/ui';
import { Heart } from 'lucide-react';
import Link from 'next/link';

const DEMO_USER_ID = 'demo-user';

export default function FavoritesPage() {
  const { favorites, isLoading, error, toggleFavorite } = useFavorites(DEMO_USER_ID);

  if (error) {
    return <div className="p-6 text-red-500">Error loading favorites.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Favorites</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg overflow-hidden bg-gray-800 aspect-[2/3]" />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Heart size={48} className="mx-auto mb-3 opacity-50" />
          <p>No favorite anime yet. Browse and click the heart on an anime to add it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {favorites.map((entry) => {
            const anime = entry.anime;
            return (
              <div key={entry.id} className="relative group">
                <Link href={`/anime/${anime.id}`} className="block">
                  <div className="relative">
                    <AnimeCard anime={anime} />
                    {anime.rating > 0 && (
                      <div className="absolute top-2 right-2">
                        <RatingBadge rating={anime.rating} maxRating={10} size="sm" />
                      </div>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => toggleFavorite.mutate({ animeId: anime.id, isFavorite: false })}
                  className="absolute top-2 left-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                >
                  <Heart size={12} fill="currentColor" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
