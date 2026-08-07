'use client';

import { PlayerSelector, QualitySelector, ThemeToggle, CacheManager } from '@samren/ui';
import { PlayerType, VideoQuality, Theme, UserPreferences } from '@samren/types';
import { useUserPreferences } from '@samren/hooks';
import { useState, useEffect } from 'react';

const DEMO_USER_ID = 'demo-user';

export default function SettingsPage() {
  const { preferences, ...preferencesQuery } = useUserPreferences(DEMO_USER_ID);
  const { updatePreferences } = preferencesQuery;

  const [player, setPlayer] = useState<PlayerType>('auto');
  const [quality, setQuality] = useState<VideoQuality>('1080p');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    if (preferences) {
      setPlayer(preferences.player ?? 'auto');
      setQuality(preferences.preferredQuality ?? '1080p');
      setTheme(preferences.theme ?? 'dark');
    }
  }, [preferences]);

  useEffect(() => {
    if (preferences) {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme, preferences]);

  const handlePreferenceChange = (updates: Partial<UserPreferences>) => {
    if (!preferences) return;
    updatePreferences.mutate({ ...preferences, ...updates });
  };

  const handlePlayerChange = (value: PlayerType) => {
    setPlayer(value);
    handlePreferenceChange({ player: value });
  };

  const handleQualityChange = (value: VideoQuality) => {
    setQuality(value);
    handlePreferenceChange({ preferredQuality: value });
  };

  const handleThemeChange = (value: Theme) => {
    setTheme(value);
    handlePreferenceChange({ theme: value });
  };

  const ready = !!preferences;

  if (preferencesQuery.isLoading && !ready) {
    return <div className="p-6 text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-0 bg-gray-900 rounded-lg overflow-hidden">
        <PlayerSelector value={player} onChange={handlePlayerChange} />
        <QualitySelector value={quality} onChange={handleQualityChange} />
        <ThemeToggle value={theme} onChange={handleThemeChange} />
        <CacheManager />
      </div>

      {updatePreferences.isError && (
        <p className="text-red-500 text-sm mt-3">Failed to save settings.</p>
      )}
    </div>
  );
}
