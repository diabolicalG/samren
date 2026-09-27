'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';

export function CacheManager() {
  const queryClient = useQueryClient();
  const [cleared, setCleared] = useState(false);

  const handleClear = () => {
    queryClient.clear();
    setCleared(true);
    window.setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <span className="text-sm font-medium text-white block">Local Cache</span>
        <span className="text-xs text-subtle">
          Clears cached anime/episode data stored in this browser tab.
        </span>
      </div>
      <button
        onClick={handleClear}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
      >
        <Trash2 size={12} />
        {cleared ? 'Cleared!' : 'Clear Cache'}
      </button>
    </div>
  );
}
