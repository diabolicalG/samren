'use client';

import { useDownloads } from '@samren/hooks';
import { Download } from '@samren/types';
import { Download as DownloadIcon } from 'lucide-react';
import { formatBytes } from '@samren/utils';

const DEMO_USER_ID = 'demo-user';

const STATUS_LABELS: Record<string, string> = {
  downloading: 'Downloading',
  completed: 'Completed',
  failed: 'Failed',
  queued: 'Queued',
};

const STATUS_COLORS: Record<string, string> = {
  downloading: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  queued: 'bg-gray-500',
};

export default function DownloadsPage() {
  const { downloads, isLoading, error, clearCache } = useDownloads(DEMO_USER_ID);

  if (error) {
    return <div className="p-6 text-red-500">Error loading downloads.</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Downloads</h1>
        <button
          onClick={() => clearCache.mutate()}
          className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
        >
          Clear Cache
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-gray-800 rounded" />
          ))}
        </div>
      ) : downloads.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <DownloadIcon size={48} className="mx-auto mb-3 opacity-50" />
          <p>No downloads. Add episodes from the anime detail page to queue them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((dl: Download) => (
            <div key={dl.id} className="flex items-center gap-4 bg-gray-900 rounded-lg p-3">
              <div className={`w-2 h-6 rounded ${STATUS_COLORS[dl.status] ?? STATUS_COLORS.queued}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[dl.status] ?? STATUS_COLORS.queued}`} />
                  <span className="text-sm font-medium text-white">
                    {STATUS_LABELS[dl.status] ?? dl.status}
                  </span>
                  {dl.progress > 0 && (
                    <span className="text-xs text-gray-400">({dl.progress}%)</span>
                  )}
                </div>
                <p className="text-sm text-gray-300 truncate">{dl.filename}</p>
              </div>
              <div className="flex-shrink-0 text-xs text-gray-400">
                {formatBytes(dl.fileSize)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
