import { getEpisodes as fetchAniWavesEpisodes, default as aniWavesProvider } from "./providers/aniwaves.js";
import { getEpisodes as fetchAnimeNoSubEpisodes, default as animeNoSubProvider } from "./providers/animenosub.js";
import { getEpisodes as fetchReAnimeEpisodes, default as reAnimeProvider } from "./providers/reanime.js";
import { getEpisodes as fetchAnimeOnsenEpisodes, getStreams as fetchAnimeOnsenStreams } from "./providers/animeonsen.js";

async function legacyWatch(
  provider: { fetch(request: Request): Promise<Response> },
  path: string,
): Promise<Record<string, unknown>> {
  const response = await provider.fetch(new Request(`https://samren-provider.internal${path}`));
  if (!response.ok) throw new Error(`Provider watch adapter returned HTTP ${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  if (payload.error) throw new Error("Provider could not resolve a playable source");
  return payload;
}

export async function getAniWavesEpisodes(anilistId: number): Promise<unknown> {
  return fetchAniWavesEpisodes(anilistId) as Promise<Record<string, unknown>>;
}

export async function getAniWavesStreams(anilistId: number, episode: number, audio: "sub" | "dub"): Promise<unknown> {
  return legacyWatch(aniWavesProvider, `/watch/aniwaves/${anilistId}/${audio}/aniwaves-${episode}`);
}

export async function getReAnimeEpisodes(anilistId: number): Promise<unknown> {
  return fetchReAnimeEpisodes(anilistId) as Promise<Record<string, unknown>>;
}

export async function getReAnimeStreams(anilistId: number, episode: number, audio: "sub" | "dub"): Promise<unknown> {
  return legacyWatch(reAnimeProvider, `/watch/${anilistId}/${audio}/${episode}`);
}

export async function getAnimeOnsenEpisodes(anilistId: number): Promise<unknown> {
  return fetchAnimeOnsenEpisodes(anilistId) as Promise<Record<string, unknown>>;
}

export async function getAnimeOnsenStreams(anilistId: number, episode: number, audio: "sub" | "dub"): Promise<unknown> {
  return fetchAnimeOnsenStreams(anilistId, episode, audio) as Promise<Record<string, unknown>>;
}

export async function getAnimeNoSubEpisodes(anilistId: number): Promise<unknown> {
  return fetchAnimeNoSubEpisodes(anilistId) as Promise<Record<string, unknown>>;
}

export async function getAnimeNoSubStreams(anilistId: number, episode: number, audio: "sub" | "dub"): Promise<unknown> {
  return legacyWatch(animeNoSubProvider, `/watch/animenosub/${anilistId}/${audio}/animenosub-${episode}`);
}
