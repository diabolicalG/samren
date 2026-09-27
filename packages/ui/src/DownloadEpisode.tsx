'use client';

import { useState } from 'react';
import type { VideoQuality } from '@samren/types';
import { Download as DownloadIcon, Check } from 'lucide-react';

const QUALITY_OPTIONS: VideoQuality[] = ['360p', '480p', '720p', '1080p'];

export function DownloadEpisode({
  animeId,
  episodeId,
  episodeNumber,
  episodeTitle,
  onDownload,
}: {
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle?: string | null;
  onDownload: (quality: VideoQuality) => void | Promise<void>;
}) {
  const [quality, setQuality] = useState<VideoQuality>('1080p');
  const [queued, setQueued] = useState(false);

  const handleClick = async () => {
    await onDownload(quality);
    setQueued(true);
    window.setTimeout(() => setQueued(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      <select
        value={quality}
        onChange={(e) => setQuality(e.target.value as VideoQuality)}
        className="bg-surface border border-border text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {QUALITY_OPTIONS.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>
      <button
        onClick={handleClick}
        disabled={!episodeId}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-opacity"
      >
        {queued ? <Check size={14} /> : <DownloadIcon size={14} />}
        {queued
          ? 'Queued'
          : `Download EP ${episodeNumber}${episodeTitle ? ` — ${episodeTitle}` : ''}`}
      </button>
      <input type="hidden" value={animeId} readOnly />
    </div>
  );
}
