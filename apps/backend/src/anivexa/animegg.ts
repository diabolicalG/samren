import { anivexaJson, anivexaText, anivexaStreamAllowedHosts, isAnivexaUrlAllowed } from "./http.js";

type AniListMedia = {
  id: number;
  title?: { english?: string | null; romaji?: string | null; native?: string | null };
  synonyms?: string[];
  status?: string;
  format?: string;
  episodes?: number | null;
  seasonYear?: number | null;
};

type SearchCandidate = { slug: string; title: string };

type SourceEpisode = {
  number: number;
  title: string;
  slug: string;
  hasSub: boolean;
  hasDub: boolean;
};

const ANILIST = "https://graphql.anilist.co";
const ANIMEGG = "https://www.animegg.org";
const USER_AGENT = "Samren/1.0 (+Anivexa provider adapter)";

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

function decodeEntities(value: string): string {
  return value.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function attribute(tag: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return decodeEntities(tag.match(new RegExp(`\\b${escaped}=["']([^"']*)["']`, "i"))?.[1] ?? "");
}

async function getAniListMedia(anilistId: number): Promise<AniListMedia> {
  const query = "query ($id: Int) { Media(id: $id, type: ANIME) { id title { english romaji native } synonyms status format episodes seasonYear } }";
  const data = await anivexaJson<{ data?: { Media?: AniListMedia }; errors?: Array<{ message?: string }> }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ query, variables: { id: anilistId } }),
  });
  if (data.errors?.length || !data.data?.Media) throw new Error("AniList did not return the requested anime");
  return data.data.Media;
}

async function search(query: string): Promise<SearchCandidate[]> {
  const url = new URL("/search/", ANIMEGG);
  url.searchParams.set("q", query);
  const html = await anivexaText(url.href, { "User-Agent": USER_AGENT, Accept: "text/html,*/*" });
  const results: SearchCandidate[] = [];
  for (const match of html.matchAll(/<a\b[^>]*class=["'][^"']*\bmse\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = match[0].match(/<a\b[^>]*>/i)?.[0] ?? "";
    const href = attribute(tag, "href");
    const slug = href.match(/^\/series\/([^/?#]+)/)?.[1];
    if (!slug) continue;
    const strong = match[0].match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1];
    results.push({ slug, title: strong ? stripTags(strong) : slug.replace(/-/g, " ") });
  }
  return results;
}

async function searchCandidates(titles: string[]): Promise<SearchCandidate[]> {
  const queries = [...new Set(titles.flatMap((title) => [title, title.replace(/[:–—].*$/, "").trim()]).filter((q) => q.length >= 3))].slice(0, 8);
  const found = new Map<string, SearchCandidate>();
  await Promise.all(queries.map(async (query) => {
    try {
      for (const candidate of await search(query)) if (!found.has(candidate.slug)) found.set(candidate.slug, candidate);
    } catch {
      // Individual title variants may not be accepted by the provider.
    }
  }));
  return [...found.values()];
}

async function scrapeSeries(slug: string): Promise<SourceEpisode[]> {
  const html = await anivexaText(new URL(`/series/${encodeURIComponent(slug)}`, ANIMEGG).href, { "User-Agent": USER_AGENT, Referer: ANIMEGG });
  const episodes: SourceEpisode[] = [];
  const seen = new Set<number>();
  for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const block = match[1];
    if (!/\banm_det_pop\b/.test(block)) continue;
    const link = block.match(/<a\b[^>]*class=["'][^"']*anm_det_pop[^"']*["'][^>]*>/i)?.[0] ?? "";
    const href = attribute(link, "href").replace(/#.*$/, "").replace(/^\//, "");
    const strong = stripTags(block.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? "");
    const number = Number((strong.match(/(\d+)(?:-\d+)?\s*$/) ?? [])[1]);
    if (!Number.isSafeInteger(number) || number < 1 || !href || seen.has(number)) continue;
    seen.add(number);
    const title = stripTags(block.match(/<i\b[^>]*class=["'][^"']*anititle[^"']*["'][^>]*>([\s\S]*?)<\/i>/i)?.[1] ?? "") || strong || `Episode ${number}`;
    episodes.push({ number, title, slug: href, hasSub: /\bbtn-subbed\b/.test(block), hasDub: /\bbtn-dubbed\b/.test(block) });
  }
  return episodes.sort((a, b) => a.number - b.number);
}

export async function getAnimeGGEpisodes(anilistId: number) {
  const media = await getAniListMedia(anilistId);
  const titles = [...new Set([media.title?.english, media.title?.romaji, media.title?.native, ...(media.synonyms ?? [])].filter((value): value is string => Boolean(value)))];
  if (!titles.length) throw new Error("AniList anime has no usable title");
  const candidates = await searchCandidates(titles);
  const ranked = candidates.map((candidate) => ({
    ...candidate,
    score: Math.max(...titles.map((title) => similarity(title, candidate.title))),
  })).filter((candidate) => candidate.score >= 0.62).sort((a, b) => b.score - a.score).slice(0, 5);
  const detailed = await Promise.all(ranked.map(async (candidate) => ({
    ...candidate,
    episodes: await scrapeSeries(candidate.slug).catch(() => []),
  })));
  const expected = Number(media.episodes ?? 0);
  const viable = detailed.filter((candidate) => candidate.episodes.length > 0)
    .map((candidate) => ({
      ...candidate,
      coverage: expected > 0 ? Math.min(1, candidate.episodes.filter((ep) => ep.number <= expected).length / expected) : 0.5,
    }))
    .sort((a, b) => (b.score * 0.8 + b.coverage * 0.2) - (a.score * 0.8 + a.coverage * 0.2));
  const selected = viable[0];
  const runnerUp = viable[1];
  if (!selected || selected.score < 0.72 || (runnerUp && selected.score - runnerUp.score < 0.04)) {
    throw new Error("AnimeGG could not be matched to this AniList entry with sufficient confidence");
  }

  const sourceEpisodes = expected > 0 ? selected.episodes.filter((episode) => episode.number <= expected) : selected.episodes;
  const sub = sourceEpisodes.filter((episode) => episode.hasSub).map((episode) => ({
    id: `watch/animegg/${anilistId}/sub/animegg-${episode.number}`,
    number: episode.number,
    title: episode.title,
    audio: "sub" as const,
  }));
  const dub = sourceEpisodes.filter((episode) => episode.hasDub).map((episode) => ({
    id: `watch/animegg/${anilistId}/dub/animegg-${episode.number}`,
    number: episode.number,
    title: episode.title,
    audio: "dub" as const,
  }));
  return {
    meta: { id: selected.slug, title: selected.title, source: "animegg", matchScore: Number(selected.score.toFixed(3)), numbering: "local", episodeOffset: 0 },
    episodes: { sub, dub },
  };
}


export async function getAnimeGGStreams(anilistId: number, episodeNumber: number, audio: "sub" | "dub") {
  const catalogue = await getAnimeGGEpisodes(anilistId);
  const sourceEpisodes = await scrapeSeries(String(catalogue.meta.id));
  const episode = sourceEpisodes.find((item) => item.number === episodeNumber);
  if (!episode || (audio === "sub" && !episode.hasSub) || (audio === "dub" && !episode.hasDub)) {
    throw new Error("AnimeGG episode or audio version was not found");
  }

  const pageUrl = new URL(`/${episode.slug.replace(/^\/+/, "")}`, ANIMEGG).href;
  const page = await anivexaText(pageUrl, { "User-Agent": USER_AGENT, Referer: ANIMEGG });
  const tabs: Array<{ embedId: string; server: string }> = [];
  for (const match of page.matchAll(/<a\b[^>]*data-toggle=["']tab["'][^>]*>/gi)) {
    const tag = match[0];
    const embedId = attribute(tag, "data-id");
    const version = attribute(tag, "data-version") || "subbed";
    if (!embedId || (version.startsWith("dub") ? "dub" : "sub") !== audio) continue;
    tabs.push({ embedId, server: attribute(tag, "data-mirror") || "AnimeGG" });
  }

  const streamHosts = anivexaStreamAllowedHosts();
  if (!streamHosts.size) throw new Error("Anivexa stream hosts have not been allowlisted");
  const results = await Promise.all(tabs.map(async (tab) => {
    const embedUrl = new URL(`/embed/${encodeURIComponent(tab.embedId)}`, ANIMEGG).href;
    const html = await anivexaText(embedUrl, { "User-Agent": USER_AGENT, Referer: ANIMEGG });
    const sourceBlock = html.match(/var\s+videoSources\s*=\s*(\[[\s\S]*?\]);/);
    if (!sourceBlock) return [];
    let parsed: Array<{ file?: string; label?: string }> = [];
    try {
      const json = sourceBlock[1]
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ': "$1"');
      const value: unknown = JSON.parse(json);
      if (Array.isArray(value)) parsed = value.filter((item): item is { file?: string; label?: string } => Boolean(item) && typeof item === "object");
    } catch {
      return [];
    }
    return parsed.flatMap((source) => {
      if (typeof source.file !== "string" || !source.file) return [];
      let url: string;
      try { url = new URL(source.file, ANIMEGG).href; } catch { return []; }
      if (!isAnivexaUrlAllowed(url, streamHosts)) return [];
      return [{
        url,
        type: url.includes(".m3u8") ? "hls" : "mp4",
        quality: String(source.label || "auto").slice(0, 32),
        provider: String(tab.server).slice(0, 64),
        audio,
      }];
    });
  }));
  const streams = results.flat();
  if (!streams.length) throw new Error("AnimeGG returned no stream URLs allowed by the configured policy");
  return { anilistId, episode: episodeNumber, audio, streams };
}
