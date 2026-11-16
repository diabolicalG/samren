import { getEpisodes as getAniWavesEpisodes, default as aniWavesProvider } from "./providers/aniwaves.js";
import { getEpisodes as getReAnimeEpisodes, default as reAnimeProvider } from "./providers/reanime.js";
import { getEpisodes as getAnimeOnsenEpisodes, getStreams as getAnimeOnsenStreams } from "./providers/animeonsen.js";

async function legacyWatch(
  provider: { fetch(request: Request): Promise<Response> },
  path: string,
): Promise<unknown> {
  const response = await provider.fetch(new Request(`https://samren-provider.internal${path}`));
  if (!response.ok) throw new Error(`Provider watch adapter returned HTTP ${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  if (payload.error) throw new Error("Provider could not resolve a playable source");
  return payload;
}

export async function getAniWavesEpisodes(anilistId: number): Promise<unknown> {
  return getAniWavesEpisodes(anilistId);
}

export async function getAniWavesStreams(anilistId: number, episode: number, audio: "sub" | "dub"): Promise<unknown> {
  return legacyWatch(aniWavesProvider, `/watch/aniwaves/${anilistId}/${audio}/aniwaves-${episode}`);
}

export async function getReAnimeEpisodes(anilistId: number): Promise<unknown> {
  return getReAnimeEpisodes(anilistId);
}

export async function getReAnimeStreams(anilistId: number, episode: number, audio: "sub" | "dub"): Promise<unknown> {
  return legacyWatch(reAnimeProvider, `/watch/${anilistId}/${audio}/${episode}`);
}

export async function getAnimeOnsenEpisodes(anilistId: number): Promise<unknown> {
  return getAnimeOnsenEpisodes(anilistId);
}

export async function getAnimeOnsenStreams(anilistId: number, episode: number, audio: "sub" | "dub"): Promise<unknown> {
  return getAnimeOnsenStreams(anilistId, episode, audio);
}
