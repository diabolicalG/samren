'use client';

import { Search } from 'lucide-react';
import type { KeyboardEvent } from 'react';

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
}) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearch(value);
  };

  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-surface border border-border text-white placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}
