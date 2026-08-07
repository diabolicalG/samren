'use client';

import { PlayerSelector, QualitySelector, ThemeToggle } from '@samren/ui';
import { PlayerType, VideoQuality, Theme } from '@samren/types';
import { useState } from 'react';

export default function AdminSettingsPage() {
  const [player, setPlayer] = useState<PlayerType>('auto');
  const [quality, setQuality] = useState<VideoQuality>('1080p');
  const [theme, setTheme] = useState<Theme>('dark');

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Admin Settings</h1>

      <div className="space-y-0 bg-gray-900 rounded-lg overflow-hidden">
        <PlayerSelector value={player} onChange={setPlayer} />
        <QualitySelector value={quality} onChange={setQuality} />
        <ThemeToggle value={theme} onChange={setTheme} />
      </div>
    </div>
  );
}
