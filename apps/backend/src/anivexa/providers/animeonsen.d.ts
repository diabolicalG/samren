export function validateAnimeOnsenOrigin(value: string, allowedHosts: Set<string>): string;
export function isAnimeOnsenMediaUrlAllowed(value: string, allowedHosts: Set<string>): boolean;
export function videoSubtitles(video: {
  metadata?: { subtitles?: Record<string, string> };
  uri?: { subtitles?: Record<string, string> };
}): Array<{
  url: string;
  label: string;
  srclang: string;
  default: boolean;
}>;
