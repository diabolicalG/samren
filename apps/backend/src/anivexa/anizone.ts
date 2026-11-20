import { anivexaFetch, anivexaJson, anivexaReadText, anivexaStreamAllowedHosts, isAnivexaUrlAllowed } from "./http.js";

type Media = {
  id: number;
  title?: { english?: string | null; romaji?: string | null; native?: string | null };
  synonyms?: string[];
  status?: string;
  format?: string;
  episodes?: number | null;
  seasonYear?: number | null;
};
type Candidate = { slug: string; title: string; titles: string[]; type: string; year: number | null; episodeCount: number };
type Episode = { number: number; sourceNumber: number; title: string; duration: number | null; hasSub: boolean };

const BASE = "https://anizone.to";
const ANILIST = "https://graphql.anilist.co";
const UA = "Samren/1.0 (+Anivexa AniZone adapter)";

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function scoreTitle(targets: string[], candidates: string[]): number {
  let best = 0;
  for (const target of targets) {
    const a = normalize(target).replace(/\s+/g, "");
    if (!a) continue;
    for (const candidate of candidates) {
      const b = normalize(candidate).replace(/\s+/g, "");
      if (!b) continue;
      if (a === b) return 1;
      if (Math.min(a.length, b.length) < 2) continue;
      const pairs = new Map<string, number>();
      for (let i = 0; i < a.length - 1; i += 1) pairs.set(a.slice(i, i + 2), (pairs.get(a.slice(i, i + 2)) ?? 0) + 1);
      let hits = 0;
      for (let i = 0; i < b.length - 1; i += 1) {
        const pair = b.slice(i, i + 2);
        const count = pairs.get(pair) ?? 0;
        if (count) { hits += 1; pairs.set(pair, count - 1); }
      }
      best = Math.max(best, (2 * hits) / (a.length + b.length - 2));
    }
  }
  return best;
}

function decodeJsonArgument(raw: string): unknown {
  const marker = "\u0001U\u0001";
  const value = raw.replace(/\\\\u([\da-f]{4})/gi, `${marker}$1`)
    .replace(/\\u([\da-f]{4})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\u0001U\u0001([\da-f]{4})/gi, "\\u$1");
  try { return JSON.parse(value); } catch { return null; }
}

function jsonArgument(html: string, name: string): unknown {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*:\\s*JSON\\.parse\\('((?:[^'\\\\]|\\\\.)*)'\\)`, "i");
  const raw = html.match(pattern)?.[1];
  return raw ? decodeJsonArgument(raw) : null;
}

function titleList(item: Record<string, unknown>): string[] {
  const values = item.title_list && typeof item.title_list === "object" ? Object.values(item.title_list as Record<string, unknown>) : [];
  return [...new Set([item.main_title, ...values].filter((value): value is string => typeof value === "string" && Boolean(value)))];
}

function formatName(value: unknown): string {
  const type = String(value || "").toLowerCase();
  if (type.includes("special")) return "special";
  if (type.includes("movie")) return "movie";
  if (type.includes("ova")) return "ova";
  if (type.includes("web") || type.includes("ona")) return "ona";
  if (type.includes("tv")) return "tv";
  return "";
}

async function getMedia(anilistId: number): Promise<Media> {
  const query = "query ($id: Int) { Media(id: $id, type: ANIME) { id title { english romaji native } synonyms status format episodes seasonYear } }";
  const data = await anivexaJson<{ data?: { Media?: Media }; errors?: Array<{ message?: string }> }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify({ query, variables: { id: anilistId } }),
  });
  if (data.errors?.length || !data.data?.Media) throw new Error("AniList did not return the requested anime");
  return data.data.Media;
}

type PageResponse = { raw: string; cookies: string[] };
type PageState = { items: unknown[]; snapshot: string; cursor: string | null; hasMore: boolean; csrf: string; cookies: Map<string, string> };

function responseCookies(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof extended.getSetCookie === "function") return extended.getSetCookie();
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

function mergeCookies(current: Map<string, string>, values: string[]): Map<string, string> {
  const merged = new Map(current);
  for (const value of values) {
    const match = String(value).match(/^\s*([^=;\s]+)=([^;]*)/);
    if (match) merged.set(match[1], match[2]);
  }
  return merged;
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function requestPage(path: string, init: RequestInit = {}): Promise<PageResponse> {
  const response = await anivexaFetch(new URL(path, BASE).href, {
    ...init,
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: `${BASE}/`,
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`AniZone upstream returned HTTP ${response.status}`);
  return { raw: await anivexaReadText(response), cookies: responseCookies(response.headers) };
}

async function fetchPage(path: string): Promise<string> {
  return (await requestPage(path)).raw;
}

function decodeEntities(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, " ");
}

function snapshot(html: string): string {
  const value = [...html.matchAll(/wire:snapshot="([^"]*)"/gi)].find((match) => match[1].includes("pages.anime-detail"))?.[1] ?? "";
  return decodeEntities(value);
}

function cursor(html: string): string | null {
  return html.match(/nextCursor:\s*'([^']+)'/i)?.[1] ?? null;
}

function hasMore(html: string): boolean {
  return /hasMore:\s*true/i.test(html);
}

function csrf(html: string): string {
  return html.match(/csrf-token"\s+content="([^"]+)"/i)?.[1] ?? "";
}

function initialPage(html: string, cookies: string[]): PageState {
  const items = jsonArgument(html, "items");
  const state = {
    items: Array.isArray(items) ? items : [],
    snapshot: snapshot(html),
    cursor: cursor(html),
    hasMore: hasMore(html),
    csrf: csrf(html),
    cookies: mergeCookies(new Map(), cookies),
  };
  if (!state.items.length || !state.snapshot || !state.csrf) throw new Error("AniZone initial episode page payload is incomplete");
  return state;
}

async function loadPage(state: PageState, slug: string): Promise<PageState> {
  const response = await requestPage("/livewire/update", {
    method: "POST",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Livewire": "",
      "X-CSRF-TOKEN": state.csrf,
      "X-Requested-With": "XMLHttpRequest",
      "Origin": BASE,
      "Referer": `${BASE}/anime/${slug}`,
      "Cookie": cookieHeader(state.cookies),
    },
    body: JSON.stringify({
      components: [{
        snapshot: state.snapshot,
        updates: {},
        calls: [{ path: "", method: "loadPage", params: [state.cursor] }],
      }],
    }),
  });
  type LivewirePayload = { components?: Array<{ snapshot?: string; effects?: { dispatches?: Array<{ name?: string; params?: { items?: unknown[]; nextCursor?: string; hasMore?: boolean } }> } }> };
  let payload: LivewirePayload;
  try { payload = JSON.parse(response.raw) as typeof payload; } catch { throw new Error("AniZone returned invalid pagination JSON"); }
  const component = payload.components?.[0];
  const dispatch = component?.effects?.dispatches?.find((item) => item.name === "items-loaded");
  if (!component?.snapshot || !Array.isArray(dispatch?.params?.items)) throw new Error("AniZone pagination response was incomplete");
  return {
    items: dispatch.params.items,
    snapshot: component.snapshot,
    cursor: dispatch.params.nextCursor ?? null,
    hasMore: Boolean(dispatch.params.hasMore),
    csrf: state.csrf,
    cookies: mergeCookies(state.cookies, response.cookies),
  };
}

async function search(query: string): Promise<Candidate[]> {
  const html = await fetchPage(`/anime?search=${encodeURIComponent(query)}`);
  const items = jsonArgument(html, "items");
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const slug = String(item.slug ?? "");
    const titles = titleList(item);
    const title = titles[0] ?? "";
    if (!/^[a-z0-9-]+$/i.test(slug) || !title) return [];
    return [{
      slug, title, titles,
      type: formatName(item.type),
      year: Number(item.start_year) || null,
      episodeCount: Number(item.episode_count) || 0,
    }];
  });
}

function parseEpisodeItems(items: unknown[]): Episode[] {
  const seen = new Set<number>();
  return items.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const url = String(item.url ?? "").replace(/\\\/+?/g, "/");
    const direct = Number(item.slug);
    const fromUrl = Number(url.match(/\/(\d+)\/?$/)?.[1]);
    const number = Number.isFinite(direct) && direct > 0 ? direct : fromUrl;
    if (!Number.isSafeInteger(number) || number < 1 || seen.has(number)) return [];
    seen.add(number);
    const titles = item.title_list && typeof item.title_list === "object" ? item.title_list as Record<string, unknown> : {};
    const title = String(titles["1"] ?? titles["5"] ?? titles["8"] ?? Object.values(titles)[0] ?? `Episode ${number}`);
    const duration = String(item.duration ?? "").match(/^(\d+):(\d{1,2})$/);
    return [{
      number, sourceNumber: number, title,
      duration: duration ? Number(duration[1]) * 60 + Number(duration[2]) : null,
      hasSub: Number(item.videos_count) > 0,
    }];
  }).sort((a, b) => a.number - b.number);
}

export function parseAniZoneEpisodes(html: string): Episode[] {
  const items = jsonArgument(html, "items");
  return Array.isArray(items) ? parseEpisodeItems(items) : [];
}


export function parseAniZonePlayerData(html: string): { src: string; subtitles: Array<{ file: string; title: string; language: string; format: string; default: boolean }> } | null {
  const match = String(html).match(/vidstackPlayer\s*\(\s*JSON\.parse\('((?:[^'\\]|\\.)*)'\)\s*\)/i);
  const value = match?.[1];
  if (!value) return null;
  const parsed = decodeJsonArgument(value);
  if (!parsed || typeof parsed !== "object") return null;
  const player = parsed as Record<string, unknown>;
  if (typeof player.src !== "string" || !player.src) return null;
  const subtitles = Array.isArray(player.subtitles) ? player.subtitles.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const subtitle = item as Record<string, unknown>;
    if (typeof subtitle.file !== "string" || !subtitle.file) return [];
    return [{
      file: subtitle.file,
      title: String(subtitle.title ?? "").slice(0, 80),
      language: String(subtitle.language ?? "").slice(0, 16),
      format: String(subtitle.format ?? "vtt").slice(0, 8),
      default: Boolean(subtitle.default),
    }];
  }) : [];
  return { src: player.src, subtitles };
}

async function scrapeEpisodes(slug: string, expected: number): Promise<Episode[]> {
  const initial = await requestPage(`/anime/${encodeURIComponent(slug)}`);
  let state = initialPage(initial.raw, initial.cookies);
  const items = [...state.items];
  let pages = 1;
  const maxPages = expected > 0 ? Math.min(20, Math.ceil(expected / 20) + 2) : 5;
  while (state.hasMore && state.cursor && items.length < (expected || 100) && pages < maxPages) {
    state = await loadPage(state, slug);
    items.push(...state.items);
    pages += 1;
  }
  return parseEpisodeItems(items);
}

export async function getAniZoneEpisodes(anilistId: number) {
  const media = await getMedia(anilistId);
  const titles = [...new Set([media.title?.english, media.title?.romaji, media.title?.native, ...(media.synonyms ?? [])].filter((value): value is string => Boolean(value)))];
  const queries = [...new Set(titles.flatMap((title) => [title, title.replace(/[:–—].*$/, "").trim()]).filter((value) => value.length >= 3))].slice(0, 8);
  const candidates = new Map<string, Candidate>();
  await Promise.all(queries.map(async (query) => {
    try { for (const candidate of await search(query)) if (!candidates.has(candidate.slug)) candidates.set(candidate.slug, candidate); } catch {}
  }));
  const expectedFormat = ({ TV: "tv", TV_SHORT: "tv", MOVIE: "movie", OVA: "ova", ONA: "ona", SPECIAL: "special" } as Record<string, string>)[String(media.format ?? "").toUpperCase()] ?? "";
  const expectedYear = Number(media.seasonYear ?? 0) || null;
  const expectedEpisodes = Number(media.episodes ?? 0);
  const ranked = [...candidates.values()].map((candidate) => {
    const titleScore = scoreTitle(titles, [...candidate.titles, candidate.slug.replace(/-/g, " ")]);
    const formatMatch = !expectedFormat || !candidate.type || expectedFormat === candidate.type;
    const yearMatch = !expectedYear || !candidate.year || expectedYear === candidate.year;
    const coverage = !expectedEpisodes || !candidate.episodeCount ? 0.5 : Math.min(1, candidate.episodeCount / expectedEpisodes);
    return { ...candidate, titleScore, formatMatch, yearMatch, coverage, score: titleScore * 0.78 + (formatMatch ? 0.12 : 0) + (yearMatch ? 0.06 : 0) + coverage * 0.04 };
  }).filter((candidate) => candidate.titleScore >= 0.72 && candidate.formatMatch && candidate.yearMatch)
    .sort((a, b) => b.score - a.score);
  const selected = ranked[0];
  if (!selected || selected.score < 0.78 || (ranked[1] && selected.score - ranked[1].score < 0.06)) {
    throw new Error("AniZone could not be matched to this AniList entry with sufficient confidence");
  }

  const sourceEpisodes = await scrapeEpisodes(selected.slug, expectedEpisodes);
  if (!sourceEpisodes.length) throw new Error("AniZone returned no episode records on its initial episode page");
  const episodes = expectedEpisodes > 0 ? sourceEpisodes.filter((episode) => episode.number <= expectedEpisodes) : sourceEpisodes;
  return {
    meta: { id: selected.slug, title: selected.title, source: "anizone", matchScore: Number(selected.titleScore.toFixed(3)), numbering: "local", episodeOffset: 0 },
    episodes: {
      sub: episodes.filter((episode) => episode.hasSub).map((episode) => ({ id: `watch/anizone/${anilistId}/sub/anizone-${episode.number}`, number: episode.number, title: episode.title, duration: episode.duration, sourceNumber: episode.sourceNumber, audio: "sub" as const })),
      dub: [],
    },
  };
}


export function aniZoneStreamType(value: string): "hls" | "mp4" | null {
  try {
    const path = new URL(value).pathname;
    if (/\.m3u8$/i.test(path)) return "hls";
    if (/\.(mp4|m4v)$/i.test(path)) return "mp4";
    return null;
  } catch {
    return null;
  }
}

export async function getAniZoneStreams(anilistId: number, episodeNumber: number, audio: "sub" | "dub") {
  if (audio !== "sub") throw new Error("AniZone currently exposes subbed streams only");
  const catalogue = await getAniZoneEpisodes(anilistId);
  const episode = catalogue.episodes.sub.find((item) => item.number === episodeNumber);
  if (!episode || !Number.isSafeInteger(episode.sourceNumber) || episode.sourceNumber < 1) {
    throw new Error("AniZone episode was not found");
  }
  const page = await fetchPage("/anime/" + encodeURIComponent(String(catalogue.meta.id)) + "/" + episode.sourceNumber);
  const player = parseAniZonePlayerData(page);
  if (!player) throw new Error("AniZone player payload was not found");
  const allowedStreams = anivexaStreamAllowedHosts();
  if (!allowedStreams.size) throw new Error("Anivexa stream hosts have not been allowlisted");
  let streamUrl: string;
  try { streamUrl = new URL(player.src, BASE).href; } catch { throw new Error("AniZone player returned an invalid stream URL"); }
  if (!isAnivexaUrlAllowed(streamUrl, allowedStreams)) throw new Error("AniZone stream host is not allowlisted");
  const streamType = aniZoneStreamType(streamUrl);
  if (!streamType) throw new Error("AniZone returned an unsupported media format");
  const subtitles = player.subtitles.flatMap((subtitle) => {
    let url: string;
    try { url = new URL(subtitle.file, BASE).href; } catch { return []; }
    if (!isAnivexaUrlAllowed(url, allowedStreams)) return [];
    return [{
      url,
      label: subtitle.title,
      srclang: subtitle.language,
      format: subtitle.format,
      default: subtitle.default,
    }];
  });
  return {
    anilistId,
    episode: episodeNumber,
    audio,
    streams: [{
      url: streamUrl,
      type: streamType,
      quality: "auto",
      provider: "AniZone",
      audio,
      subtitles,
    }],
  };
}
