'use client';

import type { Episode } from '@samren/types';
import { PlayCircle } from 'lucide-react';

export function EpisodeList({
  episodes,
  onEpisodeClick,
}: {
  episodes: Episode[];
  onEpisodeClick: (episode: Episode) => void;
}) {
  if (episodes.length === 0) {
    return <p className="text-subtle text-sm">No episodes available yet.</p>;
  }

  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {episodes.map((ep) => (
        <button
          key={ep.id}
          onClick={() => onEpisodeClick(ep)}
          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-surface text-left transition-colors"
        >
          <PlayCircle size={18} className="text-subtle flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">
              Ep {ep.number}
              {ep.title ? ` — ${ep.title}` : ''}
            </p>
          </div>
          {ep.isFiller && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 flex-shrink-0">
              Filler
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
