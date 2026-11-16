import { anivexaJson, anivexaText } from "./http.js";

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

async function fetchPage(path: string): Promise<string> {
  return anivexaText(new URL(path, BASE).href, { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", Referer: BASE });
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

function parseEpisodes(html: string): Episode[] {
  const items = jsonArgument(html, "items");
  if (!Array.isArray(items)) return [];
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

  const html = await fetchPage(`/anime/${encodeURIComponent(selected.slug)}`);
  const sourceEpisodes = parseEpisodes(html);
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
