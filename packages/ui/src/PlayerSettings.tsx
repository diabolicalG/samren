'use client';

import type { ReactNode } from 'react';
import type { PlayerType, Theme, VideoQuality } from '@samren/types';
import { Monitor, Terminal, Zap, Sun, Moon } from 'lucide-react';

function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0">
      <span className="text-sm font-medium text-white">{label}</span>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="flex gap-1 bg-background rounded-md p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            value === opt.value
              ? 'bg-accent text-white'
              : 'text-subtle hover:text-white'
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function PlayerSelector({
  value,
  onChange,
}: {
  value: PlayerType;
  onChange: (value: PlayerType) => void;
}) {
  return (
    <SettingsRow label="Player">
      <SegmentedControl
        value={value}
        onChange={onChange}
        options={[
          { value: 'auto', label: 'Auto', icon: <Zap size={12} /> },
          { value: 'browser', label: 'Browser', icon: <Monitor size={12} /> },
          { value: 'mpv', label: 'MPV', icon: <Terminal size={12} /> },
        ]}
      />
    </SettingsRow>
  );
}

const QUALITY_OPTIONS: VideoQuality[] = ['360p', '480p', '720p', '1080p'];

export function QualitySelector({
  value,
  onChange,
}: {
  value: VideoQuality;
  onChange: (value: VideoQuality) => void;
}) {
  return (
    <SettingsRow label="Preferred Quality">
      <SegmentedControl
        value={value}
        onChange={onChange}
        options={QUALITY_OPTIONS.map((q) => ({ value: q, label: q }))}
      />
    </SettingsRow>
  );
}

export function ThemeToggle({
  value,
  onChange,
}: {
  value: Theme;
  onChange: (value: Theme) => void;
}) {
  return (
    <SettingsRow label="Theme">
      <SegmentedControl
        value={value}
        onChange={onChange}
        options={[
          { value: 'dark', label: 'Dark', icon: <Moon size={12} /> },
          { value: 'light', label: 'Light', icon: <Sun size={12} /> },
        ]}
      />
    </SettingsRow>
  );
}
