'use client';

import { useDownloads } from '@samren/hooks';
import { Download as DownloadIcon } from 'lucide-react';
import { formatBytes, formatDate } from '@samren/utils';

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

export default function AdminDownloadsPage() {
  const { downloads, isLoading, error } = useDownloads(DEMO_USER_ID);

  if (error) {
    return <div className="p-6 text-red-500">Error loading downloads.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Downloads</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-gray-800 rounded" />
          ))}
        </div>
      ) : downloads.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <DownloadIcon size={48} className="mx-auto mb-3 opacity-50" />
          <p>No active downloads.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((dl) => (
            <div key={dl.id} className="flex items-center justify-between bg-card rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-6 rounded ${STATUS_COLORS[dl.status] ?? STATUS_COLORS.queued}`}
                />
                <div>
                  <p className="font-medium text-white">{dl.filename}</p>
                  <p className="text-xs text-gray-400">
                    {STATUS_LABELS[dl.status] ?? dl.status} • {formatBytes(dl.fileSize)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400">
                  {dl.createdAt ? formatDate(dl.createdAt) : ''}
                </span>
                <div className="w-16 h-1.5 bg-gray-700 rounded mt-1 overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${dl.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
