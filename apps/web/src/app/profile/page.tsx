'use client';

import { useUserPreferences } from '@samren/hooks';
import { Settings, User } from 'lucide-react';

const DEMO_USER_ID = 'demo-user';

export default function ProfilePage() {
  const { preferences, isLoading } = useUserPreferences(DEMO_USER_ID);

  if (isLoading) {
    return <div className="p-6 text-gray-400">Loading profile...</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
          <User size={40} className="text-gray-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Demo User</h1>
          <p className="text-gray-400">demo@example.com</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings size={18} />
          Preferences
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Player</span>
            <span className="text-gray-300">{preferences?.player ?? 'Auto'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Quality</span>
            <span className="text-gray-300">{preferences?.preferredQuality ?? '1080p'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Theme</span>
            <span className="text-gray-300 capitalize">{preferences?.theme ?? 'Dark'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Subtitles</span>
            <span className="text-gray-300">{preferences?.subtitles ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Dub</span>
            <span className="text-gray-300">{preferences?.dub ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
