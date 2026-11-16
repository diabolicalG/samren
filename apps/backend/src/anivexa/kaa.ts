import { anivexaJson, anivexaStreamAllowedHosts, isAnivexaUrlAllowed } from "./http.js";

type Media = {
  id: number;
  idMal?: number | null;
  title?: { english?: string | null; romaji?: string | null; native?: string | null };
  synonyms?: string[];
  format?: string | null;
  seasonYear?: number | null;
  episodes?: number | null;
};
type SearchItem = { slug?: string; title?: string; title_en?: string; year?: number; type?: string; locales?: string[] };
type Episode = { number: number; sourceNumber: number; fullSlug: string; title: string; duration: number | null };
type Server = { src?: string; name?: string };

const BASE = "https://kaa.lt";
const ANILIST = "https://graphql.anilist.co";
const HLS_BASE = "https://hls.krussdomi.com/manifest";
const USER_AGENT = "Samren/1.0 (+Anivexa KickAssAnime adapter)";
const MAX_EPISODE_PAGES = 40;

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function similarity(left: string, right: string): number {
  const a = normalize(left).replace(/\s+/g, "");
  const b = normalize(right).replace(/\s+/g, "");
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) pairs.set(a.slice(i, i + 2), (pairs.get(a.slice(i, i + 2)) ?? 0) + 1);
  let hits = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const pair = b.slice(i, i + 2);
    const count = pairs.get(pair) ?? 0;
    if (count > 0) { hits += 1; pairs.set(pair, count - 1); }
  }
  return (2 * hits) / (a.length + b.length - 2);
}

function titleValues(media: Media): string[] {
  return [...new Set([media.title?.english, media.title?.romaji, media.title?.native, ...(media.synonyms ?? [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length >= 3)
    .map((value) => value.trim()))];
}

function searchQueries(titles: string[]): string[] {
  return [...new Set(titles.flatMap((title) => {
    const clean = title.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    const words = clean.split(" ").filter(Boolean);
    return [clean, words.slice(0, 3).join(" ")].filter((value) => value.length >= 3);
  }))].slice(0, 12);
}

export function parseKaaServerId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    if (url.hostname.toLowerCase() !== "kaa.lt" && url.hostname.toLowerCase() !== "www.kaa.lt") return null;
    const id = url.searchParams.get("id");
    return id && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function buildKaaStreamUrl(id: string, allowedHosts: Set<string>): string | null {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  const url = new URL(`/manifest/${encodeURIComponent(id)}/master.m3u8`, HLS_BASE).href;
  return isAnivexaUrlAllowed(url, allowedHosts) ? url : null;
}

async function getMedia(anilistId: number): Promise<Media> {
  const query = "query ($id: Int) { Media(id: $id, type: ANIME) { id idMal title { english romaji native } synonyms format seasonYear episodes } }";
  const result = await anivexaJson<{ data?: { Media?: Media }; errors?: unknown[] }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ query, variables: { id: anilistId } }),
  });
  if (result.errors?.length || !result.data?.Media) throw new Error("AniList did not return the requested anime");
  return result.data.Media;
}

async function search(query: string): Promise<SearchItem[]> {
  const data = await anivexaJson<{ result?: SearchItem[] }>(new URL("/api/fsearch", BASE).href, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ page: 1, query }),
  });
  return Array.isArray(data.result) ? data.result : [];
}

function formatMatches(mediaFormat: string | null | undefined, providerType: string | undefined): boolean {
  const expected = String(mediaFormat ?? "").toUpperCase();
  const actual = String(providerType ?? "").toLowerCase();
  if (!actual || !expected) return true;
  if (expected === "MOVIE") return actual === "movie";
  if (["TV", "TV_SHORT"].includes(expected)) return ["tv", "ova", "special"].includes(actual);
  if (expected === "OVA") return actual === "ova" || actual === "tv";
  if (expected === "ONA") return actual === "ona" || actual === "tv";
  if (expected === "SPECIAL") return actual === "special" || actual === "ova";
  return true;
}

async function resolveSeries(media: Media): Promise<{ slug: string; title: string; score: number; locales: string[] }> {
  const titles = titleValues(media);
  if (!titles.length) throw new Error("AniList anime has no usable title");
  const queries = searchQueries(titles);
  const results = await Promise.all(queries.map(async (query) => {
    try { return await search(query); } catch { return []; }
  }));
  const candidates = new Map<string, SearchItem>();
  for (const batch of results) {
    for (const item of batch) {
      if (typeof item.slug === "string" && /^[a-z0-9-]+$/i.test(item.slug)) candidates.set(item.slug, item);
    }
  }
  const ranked = [...candidates.values()].map((item) => {
    const titleScore = Math.max(...titles.map((title) => Math.max(similarity(title, String(item.title_en || "")), similarity(title, String(item.title || "")), similarity(title, String(item.slug || "").replace(/-/g, " ")))));
    const yearScore = !media.seasonYear || !item.year ? 1 : media.seasonYear === item.year ? 1 : Math.abs(media.seasonYear - item.year) === 1 ? 0.8 : 0.45;
    const formatOk = formatMatches(media.format, item.type);
    return { item, titleScore, score: titleScore * 0.82 + yearScore * 0.10 + (formatOk ? 0.08 : 0), formatOk };
  }).filter((entry) => entry.formatOk && entry.titleScore >= 0.68).sort((a, b) => b.score - a.score);
  const selected = ranked[0];
  if (!selected || selected.titleScore < 0.72 || (ranked[1] && selected.score - ranked[1].score < 0.035)) {
    throw new Error("KickAssAnime could not be matched to this AniList entry with sufficient confidence");
  }
  return {
    slug: selected.item.slug!,
    title: String(selected.item.title_en || selected.item.title || selected.item.slug),
    score: selected.titleScore,
    locales: Array.isArray(selected.item.locales) ? selected.item.locales.filter((value): value is string => typeof value === "string") : [],
  };
}

async function episodePage(slug: string, episode: number): Promise<{ pages: Array<{ eps?: number[] }>; result: Array<Record<string, unknown>> }> {
  return anivexaJson(new URL(`/api/show/${encodeURIComponent(slug)}/episodes?ep=${episode}&lang=ja-JP`, BASE).href, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
}

async function fetchEpisodes(slug: string, showInfo: Record<string, unknown>): Promise<Episode[]> {
  if (showInfo.type === "movie") {
    const match = String(showInfo.watch_uri ?? "").match(/\/(ep-(\d+)-([a-f0-9]+))$/i);
    return match ? [{ number: 1, sourceNumber: Number(match[2]), fullSlug: match[1], title: "Movie", duration: null }] : [];
  }
  const first = await episodePage(slug, 1);
  const batches: Array<Record<string, unknown>[]> = [Array.isArray(first.result) ? first.result : []];
  const pages = Array.isArray(first.pages) ? first.pages : [];
  for (const page of pages.slice(1, MAX_EPISODE_PAGES)) {
    const start = Array.isArray(page.eps) ? Number(page.eps[0]) : 0;
    if (!Number.isSafeInteger(start) || start < 1) continue;
    const next = await episodePage(slug, start);
    if (Array.isArray(next.result)) batches.push(next.result);
  }
  const seen = new Set<number>();
  return batches.flat().flatMap((item) => {
    const number = Number(item.episode_number);
    const sourceSlug = String(item.slug ?? "");
    if (!Number.isSafeInteger(number) || number < 1 || !/^[a-f0-9]+$/i.test(sourceSlug) || seen.has(number)) return [];
    seen.add(number);
    return [{
      number, sourceNumber: number, fullSlug: `ep-${number}-${sourceSlug}`,
      title: String(item.title ?? `Episode ${number}`).slice(0, 200),
      duration: Number.isFinite(Number(item.duration_ms)) ? Math.round(Number(item.duration_ms) / 1000) : null,
    }];
  }).sort((a, b) => a.number - b.number);
}

async function showInfo(slug: string): Promise<Record<string, unknown>> {
  return anivexaJson(new URL(`/api/show/${encodeURIComponent(slug)}`, BASE).href, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
}

export async function getKaaEpisodes(anilistId: number) {
  const media = await getMedia(anilistId);
  const series = await resolveSeries(media);
  const info = await showInfo(series.slug);
  const episodes = await fetchEpisodes(series.slug, info);
  if (!episodes.length) throw new Error("KickAssAnime returned no episode records");
  const expected = Number(media.episodes ?? 0);
  const bounded = expected > 0 ? episodes.filter((episode) => episode.number <= expected) : episodes;
  const locales = Array.isArray(info.locales) ? info.locales.filter((value): value is string => typeof value === "string") : series.locales;
  const base = (episode: Episode, audio: "sub" | "dub") => ({
    id: `watch/kaa/${anilistId}/${audio}/kaa-${episode.number}`,
    number: episode.number,
    sourceNumber: episode.sourceNumber,
    title: episode.title,
    duration: episode.duration,
    audio,
  });
  const hasDub = locales.includes("en-US");
  return {
    meta: { id: series.slug, title: series.title, source: "kaa", matchScore: Number(series.score.toFixed(3)), numbering: "local", episodeOffset: 0 },
    episodes: { sub: bounded.map((episode) => base(episode, "sub")), dub: hasDub ? bounded.map((episode) => base(episode, "dub")) : [] },
  };
}

export async function getKaaStreams(anilistId: number, episodeNumber: number, audio: "sub" | "dub") {
  const media = await getMedia(anilistId);
  const series = await resolveSeries(media);
  const info = await showInfo(series.slug);
  const episodes = await fetchEpisodes(series.slug, info);
  const expected = Number(media.episodes ?? 0);
  const bounded = expected > 0 ? episodes.filter((episode) => episode.number <= expected) : episodes;
  const locales = Array.isArray(info.locales) ? info.locales.filter((value): value is string => typeof value === "string") : series.locales;
  const episode = bounded.find((item) => item.number === episodeNumber);
  if (!episode) throw new Error("KickAssAnime episode was not found");
  if (audio === "dub" && !locales.includes("en-US")) throw new Error("KickAssAnime has no English dub for this series");
  const data = await anivexaJson<{ servers?: Server[] }>(new URL(`/api/show/${encodeURIComponent(series.slug)}/episode/${encodeURIComponent(episode.fullSlug)}`, BASE).href, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  const allowed = anivexaStreamAllowedHosts();
  if (!allowed.size) throw new Error("Anivexa stream hosts have not been allowlisted");
  const streams = (Array.isArray(data.servers) ? data.servers : []).flatMap((server) => {
    if (typeof server.src !== "string") return [];
    const id = parseKaaServerId(server.src);
    if (!id) return [];
    const url = buildKaaStreamUrl(id, allowed);
    if (!url) return [];
    return [{ url, type: "hls", provider: "KickAssAnime", server: String(server.name || "KAA").slice(0, 64), quality: "auto", audio, referer: "https://krussdomi.com/" }];
  });
  const unique = [...new Map(streams.map((stream) => [stream.url, stream])).values()];
  if (!unique.length) throw new Error("KickAssAnime returned no stream URLs allowed by the configured policy");
  return { anilistId, episode: episodeNumber, audio, streams: unique };
}
