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

export function getEpisodes(anilistId: number, context?: Record<string, unknown>): Promise<unknown>;
export function getStreams(anilistId: number, episode: number, audio?: "sub" | "dub"): Promise<{
  anilistId: number;
  episode: number;
  audio: "sub" | "dub";
  streams: Array<Record<string, unknown>>;
}>;
