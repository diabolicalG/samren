import type { Anime } from '@samren/types';

export function RatingBadge({
  rating,
  maxRating = 10,
  size = 'md',
}: {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md';
}) {
  const pct = maxRating > 0 ? rating / maxRating : 0;
  const color =
    pct >= 0.75 ? 'bg-green-500/90' : pct >= 0.5 ? 'bg-yellow-500/90' : 'bg-gray-500/90';
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold text-white ${color} ${sizeClasses}`}
    >
      ★ {rating.toFixed(1)}
    </span>
  );
}

export function AnimeCard({ anime }: { anime: Anime }) {
  return (
    <div className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-surface">
      {anime.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={anime.coverImage}
          alt={anime.title}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-subtle text-xs p-2 text-center">
          {anime.title}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-6">
        <p className="text-xs font-medium text-white line-clamp-2">{anime.title}</p>
        {anime.year > 0 && <p className="text-[10px] text-subtle mt-0.5">{anime.year}</p>}
      </div>
    </div>
  );
}
