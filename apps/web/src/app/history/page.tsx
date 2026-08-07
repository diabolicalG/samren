'use client';

import { useHistory } from '@samren/hooks';
import { HistoryEntry } from '@samren/types';
import { PlayCircle } from 'lucide-react';
import { formatDate, calculateProgress } from '@samren/utils';

const DEMO_USER_ID = 'demo-user';

export default function HistoryPage() {
  const { data, isLoading, error } = useHistory(DEMO_USER_ID);
  const history: HistoryEntry[] = data?.data ?? [];

  if (error) {
    return <div className="p-6 text-red-500">Error loading history.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Watch History</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-gray-800 rounded" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <PlayCircle size={48} className="mx-auto mb-3 opacity-50" />
          <p>No watch history yet. Start watching an anime to see your progress here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="flex gap-3 items-center bg-gray-900 rounded-lg p-3">
              <div className="relative flex-shrink-0 w-16 h-9">
                <img
                  src={entry.anime?.coverImage}
                  alt={entry.anime?.title}
                  className="w-full h-full object-cover rounded"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{entry.anime?.title}</p>
                <p className="text-xs text-gray-400">
                  EP {entry.episodeNumber} • {formatDate(entry.createdAt)}
                </p>
              </div>
              <div className="flex-shrink-0 text-xs text-gray-400">
                Progress: {calculateProgress(entry.currentTime, entry.duration)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
