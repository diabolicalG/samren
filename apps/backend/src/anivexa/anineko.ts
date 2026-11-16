import { anivexaFetch, anivexaReadText, anivexaStreamAllowedHosts, anivexaText, isAnivexaUrlAllowed } from "./http.js";

type Media = { id: number; title?: { english?: string | null; romaji?: string | null; native?: string | null }; synonyms?: string[]; episodes?: number | null };
type Episode = { number: number; title: string; hasSub: boolean; hasDub: boolean };
type Candidate = { slug: string; title: string };
const BASE = "https://anineko.to";
const ANILIST = "https://graphql.anilist.co";
const UA = "Samren/1.0 (+Anivexa AniNeko adapter)";

function decode(value: string): string {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)));
}
function text(value: string): string { return decode(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()); }
function attr(tag: string, name: string): string {
  const pattern = new RegExp("\\b" + name + "\\s*=\\s*[\\x22']([^\\x22']*)[\\x22']", "i");
  return decode(tag.match(pattern)?.[1] ?? "");
}
function norm(value: string): string { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, ""); }
function score(a0: string, b0: string): number {
  const a = norm(a0), b = norm(b0);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 2) return 0;
  const pairs = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) pairs.set(a.slice(i, i + 2), (pairs.get(a.slice(i, i + 2)) ?? 0) + 1);
  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) { const p = b.slice(i, i + 2), n = pairs.get(p) ?? 0; if (n) { hits++; pairs.set(p, n - 1); } }
  return 2 * hits / (a.length + b.length - 2);
}

export function parseAniNekoSearchResults(html: string): Candidate[] {
  const found = new Map<string, Candidate>();
  for (const m of html.matchAll(/<a\b[^>]*class=["'][^"']*\bnv-anime-thumb\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = m[0].match(/<a\b[^>]*>/i)?.[0] ?? "";
    let url: URL;
    try { url = new URL(attr(tag, "href"), BASE); } catch { continue; }
    if (url.protocol !== "https:" || url.hostname !== "anineko.to") continue;
    const slug = url.pathname.match(/^\/watch\/([a-z0-9-]+)\/?$/i)?.[1];
    if (!slug || found.has(slug)) continue;
    const title = text(m[0].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? slug.replace(/-/g, " "));
    found.set(slug, { slug, title });
  }
  return [...found.values()];
}

export function parseAniNekoEpisodes(html: string): Episode[] {
  const found = new Map<number, Episode>();
  for (const m of html.matchAll(/<article\b[^>]*class=["'][^"']*\bnv-info-episode-item\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
    const block = m[1];
    const link = block.match(/<a\b[^>]*class=["'][^"']*\bnv-info-episode-main\b[^"']*["'][^>]*>/i)?.[0] ?? "";
    const number = Number(attr(link, "href").match(/\/ep-(\d+)/i)?.[1]);
    if (!Number.isSafeInteger(number) || number < 1 || found.has(number)) continue;
    const title = text(block.match(/<a\b[^>]*class=["'][^"']*\bnv-info-episode-main\b[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const badges = [...block.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map(x => text(x[1]).toLowerCase());
    found.set(number, { number, title: title || "Episode " + number, hasSub: badges.includes("sub"), hasDub: badges.includes("dub") });
  }
  return [...found.values()].sort((a, b) => a.number - b.number);
}

export function parseAniNekoServerEmbeds(html: string, audio: "sub" | "dub"): string[] {
  const found = new Set<string>();
  const panels = /<div\b([^>]*class=["'][^"']*\bnv-server-grid\b[^"']*["'][^>]*)>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\bnv-server-grid\b|$)/gi;
  for (const m of html.matchAll(panels)) {
    const kind = /\bdub\b/i.test(attr(m[1], "data-id")) ? "dub" : "sub";
    if (kind !== audio) continue;
    for (const button of m[2].matchAll(/\bdata-video=["']([^"']+)["']/gi)) {
      try {
        const url = new URL(decode(button[1]), BASE);
        if (url.protocol === "https:" && url.hostname !== "anineko.to") found.add(url.href);
      } catch { /* ignore malformed provider values */ }
    }
  }
  return [...found];
}
export function parseAniNekoHls(html: string): string | null {
  const value = html.match(/["'](https:\/\/[^"'\s]+\.m3u8(?:\?[^"']*)?)["']/i)?.[1];
  if (!value) return null;
  try { const url = new URL(decode(value)); return url.protocol === "https:" && /\.m3u8$/i.test(url.pathname) ? url.href : null; }
  catch { return null; }
}

async function mediaFor(id: number): Promise<Media> {
  const query = "query ($id: Int) { Media(id: $id, type: ANIME) { id title { english romaji native } synonyms episodes } }";
  const response = await anivexaFetch(ANILIST, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA }, body: JSON.stringify({ query, variables: { id } }) });
  if (!response.ok) throw new Error("AniList lookup failed");
  const result = await response.json() as { data?: { Media?: Media }; errors?: unknown[] };
  if (result.errors?.length || !result.data?.Media) throw new Error("AniList media not found");
  return result.data.Media;
}
async function search(query: string): Promise<Candidate[]> {
  return parseAniNekoSearchResults(await anivexaText(BASE + "/browser?keyword=" + encodeURIComponent(query), { "User-Agent": UA, Accept: "text/html", Referer: BASE + "/" }));
}
async function episodes(slug: string): Promise<Episode[]> {
  return parseAniNekoEpisodes(await anivexaText(BASE + "/watch/" + encodeURIComponent(slug), { "User-Agent": UA, Accept: "text/html", Referer: BASE + "/" }));
}
async function resolve(id: number) {
  const media = await mediaFor(id);
  const titles = [...new Set([media.title?.english, media.title?.romaji, media.title?.native, ...(media.synonyms ?? [])].filter((x): x is string => Boolean(x)))];
  if (!titles.length) throw new Error("AniList media has no titles");
  const candidates = new Map<string, Candidate>();
  for (const title of titles.slice(0, 4)) { try { for (const item of await search(title)) candidates.set(item.slug, item); } catch { /* try other titles */ } }
  const ranked = [...candidates.values()].map(candidate => ({ candidate, score: Math.max(...titles.map(title => score(title, candidate.title))) }))
    .filter(item => item.score >= 0.68).sort((a, b) => b.score - a.score).slice(0, 8);
  const inspected = await Promise.all(ranked.map(async item => { try { return { ...item, episodes: await episodes(item.candidate.slug) }; } catch { return null; } }));
  const valid = inspected.filter((x): x is NonNullable<typeof x> => Boolean(x?.episodes.length))
    .filter(x => !media.episodes || x.episodes.length >= Math.min(media.episodes, 3)).sort((a, b) => b.score - a.score);
  const best = valid[0], runner = valid[1];
  if (!best || best.score < 0.78 || (runner && best.score - runner.score < 0.08)) throw new Error("AniNeko match is not sufficiently confident");
  return { ...best, media };
}

export async function getAniNekoEpisodes(anilistId: number) {
  const series = await resolve(anilistId);
  const limit = Number(series.media.episodes) || 0;
  const sub = [], dub = [];
  for (const ep of series.episodes) {
    if (limit && ep.number > limit) continue;
    const base = { number: ep.number, title: ep.title, duration: null, filler: false, uncensored: false, description: null, image: null, airDate: null, sourceNumber: ep.number };
    if (ep.hasSub) sub.push({ id: "watch/anineko/" + anilistId + "/sub/anineko-" + ep.number, ...base, audio: "sub" as const });
    if (ep.hasDub) dub.push({ id: "watch/anineko/" + anilistId + "/dub/anineko-" + ep.number, ...base, audio: "dub" as const });
  }
  return { meta: { id: series.candidate.slug, title: series.candidate.title, source: "anineko", matchScore: Number(series.score.toFixed(3)), numbering: "standard", episodeOffset: 0 }, episodes: { sub, dub } };
}

export async function getAniNekoStreams(anilistId: number, episodeNumber: number, audio: "sub" | "dub") {
  const series = await resolve(anilistId);
  const episode = series.episodes.find(item => item.number === episodeNumber);
  if (!episode || (audio === "sub" && !episode.hasSub) || (audio === "dub" && !episode.hasDub)) throw new Error("AniNeko episode/audio variant not found");
  const page = BASE + "/watch/" + series.candidate.slug + "/ep-" + episodeNumber;
  const html = await anivexaText(page, { "User-Agent": UA, Accept: "text/html", Referer: BASE + "/watch/" + series.candidate.slug });
  const embeds = parseAniNekoServerEmbeds(html, audio);
  if (!embeds.length) throw new Error("AniNeko has no servers for this audio variant");
  const streamHosts = anivexaStreamAllowedHosts();
  const resolved = await Promise.all(embeds.map(async embed => {
    if (!isAnivexaUrlAllowed(embed)) return null;
    try {
      const response = await anivexaFetch(embed, { headers: { "User-Agent": UA, Accept: "text/html", Referer: page } });
      if (!response.ok) return null;
      const hls = parseAniNekoHls(await anivexaReadText(response));
      return hls && isAnivexaUrlAllowed(hls, streamHosts) ? { url: hls, type: "hls" as const } : { url: embed, type: "embed" as const };
    } catch { return { url: embed, type: "embed" as const }; }
  }));
  const streams = resolved.filter((x): x is NonNullable<typeof x> => Boolean(x)).map((item, index) => ({
    url: item.url, type: item.type, server: "AniNeko", audio, referer: new URL(item.url).origin + "/", priority: 5 - index, isActive: index === 0,
  })).filter(item => item.type === "hls" ? isAnivexaUrlAllowed(item.url, streamHosts) : isAnivexaUrlAllowed(item.url));
  if (!streams.length) throw new Error("AniNeko returned no allowlisted streams");
  return { anilistId, episode: episodeNumber, providerEpisode: episodeNumber, audio, streams };
}
