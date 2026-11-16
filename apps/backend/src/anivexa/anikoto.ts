import { anivexaJson, anivexaText } from "./http.js";

type Media = {
  id: number;
  idMal?: number | null;
  title?: { english?: string | null; romaji?: string | null; native?: string | null };
  synonyms?: string[];
  episodes?: number | null;
  format?: string;
};
type Candidate = { slug: string; name: string; japanese: string };
type Episode = { number: number; ids: string; title: string; hasSub: boolean; hasDub: boolean; malId: number | null };

const BASE = "https://anikototv.to";
const ANILIST = "https://graphql.anilist.co";
const UA = "Samren/1.0 (+Anivexa AniKoto adapter)";

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
}

function similarity(left: string, right: string): number {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 2) return 0;
  const pairs = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) pairs.set(a.slice(i, i + 2), (pairs.get(a.slice(i, i + 2)) ?? 0) + 1);
  let hits = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const pair = b.slice(i, i + 2);
    const count = pairs.get(pair) ?? 0;
    if (count) { hits += 1; pairs.set(pair, count - 1); }
  }
  return (2 * hits) / (a.length + b.length - 2);
}

function decode(value: string): string {
  return value.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

async function mediaFor(anilistId: number): Promise<Media> {
  const query = "query ($id: Int) { Media(id: $id, type: ANIME) { id idMal title { english romaji native } synonyms episodes format } }";
  const data = await anivexaJson<{ data?: { Media?: Media }; errors?: unknown[] }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify({ query, variables: { id: anilistId } }),
  });
  if (data.errors?.length || !data.data?.Media) throw new Error("AniList media was not found");
  return data.data.Media;
}

async function search(query: string): Promise<Candidate[]> {
  const html = await anivexaText(`${BASE}/filter?keyword=${encodeURIComponent(query)}`, { "User-Agent": UA, Accept: "text/html", Referer: `${BASE}/` });
  const found: Candidate[] = [];
  const pattern = /<a\s+class=["']name d-title["']\s+href=["']https:\/\/anikototv\.to\/watch\/([^/"']+)(?:\/ep-\d+)?["'][^>]*data-jp=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const slug = match[1];
    if (!/^[a-z0-9-]+$/i.test(slug)) continue;
    found.push({ slug, japanese: decode(match[2]), name: decode(match[3].replace(/<[^>]*>/g, " ").trim()) });
  }
  return [...new Map(found.map((item) => [item.slug, item])).values()];
}

function parseEpisodes(html: string): Episode[] {
  const found = new Map<number, Episode>();
  const pattern = /<a\s+[^>]*data-id=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const tag = match[0];
    const attr = (name: string) => decode(tag.match(new RegExp(`data-${name}=["']([^"']*)["']`, "i"))?.[1] ?? "");
    const number = Number.parseInt(attr("num"), 10);
    if (!Number.isSafeInteger(number) || number < 1 || found.has(number)) continue;
    const title = decode(match[2].match(/<span\s+class=["']d-title["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]*>/g, " ").trim() ?? "");
    found.set(number, { number, ids: attr("ids"), title: title || `Episode ${number}`, hasSub: attr("sub") === "1", hasDub: attr("dub") === "1", malId: Number.parseInt(attr("mal"), 10) || null });
  }
  return [...found.values()].sort((a, b) => a.number - b.number);
}

async function inspect(candidate: Candidate): Promise<(Candidate & { episodes: Episode[] }) | null> {
  const html = await anivexaText(`${BASE}/watch/${encodeURIComponent(candidate.slug)}`, { "User-Agent": UA, Accept: "text/html", Referer: `${BASE}/` });
  const showId = html.match(/data-id=["'](\d+)["']/i)?.[1];
  if (!showId) return null;
  const payload = await anivexaJson<{ result?: string }>(`${BASE}/ajax/episode/list/${encodeURIComponent(showId)}`, {
    headers: { "User-Agent": UA, Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/watch/${candidate.slug}` },
  });
  const episodes = parseEpisodes(payload.result ?? "");
  return episodes.length ? { ...candidate, episodes } : null;
}

export function parseAniKotoEpisodes(html: string): Episode[] {
  return parseEpisodes(html);
}

export async function getAniKotoEpisodes(anilistId: number) {
  const media = await mediaFor(anilistId);
  const titles = [...new Set([media.title?.english, media.title?.romaji, media.title?.native, ...(media.synonyms ?? [])].filter((value): value is string => Boolean(value)))];
  const queries = [...new Set(titles.flatMap((title) => [title, title.replace(/[:–—].*$/, "").trim()]).filter((value) => value.length >= 3))].slice(0, 12);
  const candidates = new Map<string, Candidate>();
  for (let index = 0; index < queries.length; index += 4) {
    const batch = await Promise.all(queries.slice(index, index + 4).map((query) => search(query).catch(() => [])));
    for (const list of batch) for (const item of list) candidates.set(item.slug, item);
  }
  const ranked = [...candidates.values()].map((item) => ({
    ...item,
    score: Math.max(...titles.map((title) => Math.max(similarity(title, item.name), similarity(title, item.japanese), similarity(title, item.slug.replace(/-/g, " "))))),
  })).filter((item) => item.score >= 0.72).sort((a, b) => b.score - a.score).slice(0, 8);
  if (!ranked.length || ranked[1] && ranked[0].score - ranked[1].score < 0.06) throw new Error("AniKoto title match was ambiguous");
  const inspected = await Promise.all(ranked.slice(0, 4).map((item) => inspect(item).catch(() => null)));
  const valid = inspected.filter((item): item is Candidate & { episodes: Episode[] } => Boolean(item));
  const expectedMal = Number(media.idMal) || null;
  const exact = expectedMal ? valid.filter((item) => item.episodes.some((episode) => episode.malId === expectedMal)) : [];
  const selected = (exact.length ? exact : valid.filter((item) => !item.episodes.some((episode) => episode.malId))).sort((a, b) => {
    const aCount = a.episodes.filter((episode) => !expectedMal || episode.malId === expectedMal).length;
    const bCount = b.episodes.filter((episode) => !expectedMal || episode.malId === expectedMal).length;
    return bCount - aCount;
  })[0];
  if (!selected) throw new Error("AniKoto did not return a confident episode list");
  const episodes = selected.episodes.filter((episode) => !expectedMal || !episode.malId || episode.malId === expectedMal);
  return {
    meta: { id: selected.slug, title: selected.name, source: "anikoto", matchScore: Number(ranked[0].score.toFixed(3)), malId: expectedMal },
    episodes: {
      sub: episodes.filter((episode) => episode.hasSub).map((episode) => ({ id: `watch/anikoto/${anilistId}/sub/anikoto-${episode.number}`, number: episode.number, title: episode.title, audio: "sub" as const })),
      dub: episodes.filter((episode) => episode.hasDub).map((episode) => ({ id: `watch/anikoto/${anilistId}/dub/anikoto-${episode.number}`, number: episode.number, title: episode.title, audio: "dub" as const })),
    },
  };
}
