'use client';

import { useSchedule } from '@samren/hooks';
import { AnimeCard, RatingBadge } from '@samren/ui';
import Link from 'next/link';

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export default function AdminSchedulePage() {
  const { data, isLoading, error } = useSchedule();
  const schedule = data?.data ?? {};

  if (error) {
    return <div className="p-6 text-red-500">Error loading schedule.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Schedule</h1>

      {isLoading ? (
        <div className="space-y-6">
          {DAYS.map((d) => (
            <div key={d} className="h-24 animate-pulse bg-gray-800 rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {DAYS.map((day) => {
            const dayAnime = schedule[day] ?? [];
            return (
              <div key={day}>
                <h2 className="text-lg font-semibold mb-2 capitalize">{day}</h2>
                {dayAnime.length === 0 ? (
                  <p className="text-gray-500 text-sm">No anime scheduled.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {dayAnime.map((anime) => (
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
          })}
        </div>
      )}
    </div>
  );
}
