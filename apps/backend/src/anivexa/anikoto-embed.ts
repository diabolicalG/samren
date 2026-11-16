import { createDecipheriv } from "node:crypto";
import { anivexaJson, anivexaText, anivexaAllowedHosts, isAnivexaUrlAllowed } from "./http.js";

type ExtractedSource = { url: string; type: "hls" | "mp4" };

function mediaType(value: string): "hls" | "mp4" | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (/\.m3u8$/i.test(url.pathname)) return "hls";
    if (/\.(mp4|m4v|webm)$/i.test(url.pathname)) return "mp4";
    return null;
  } catch { return null; }
}

function decodeFragment(value: string): string | null {
  const fragment = value.split("#")[1] ?? "";
  if (!/^[a-z\d+/_=-]{12,}$/i.test(fragment)) return null;
  try {
    const decoded = Buffer.from(fragment.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return /^https:\/\//i.test(decoded) ? decoded : null;
  } catch { return null; }
}

function scriptStrings(script: string): string[] {
  const values: string[] = [];
  let index = 0;
  while (index < script.length) {
    const char = script[index];
    if (char === "/" && script[index + 1] === "/") {
      const end = script.indexOf("\n", index + 2);
      index = end < 0 ? script.length : end + 1;
      continue;
    }
    if (char === "/" && script[index + 1] === "*") {
      const end = script.indexOf("*/", index + 2);
      index = end < 0 ? script.length : end + 2;
      continue;
    }
    if (char !== "'" && char !== '"') { index += 1; continue; }
    const quote = char;
    let value = "";
    index += 1;
    while (index < script.length && script[index] !== quote) {
      if (script[index] === "\\" && index + 1 < script.length) {
        index += 1;
        const escaped = script[index];
        value += ({ n: "\n", r: "\r", t: "\t" } as Record<string, string>)[escaped] ?? escaped;
        index += 1;
      } else { value += script[index]; index += 1; }
    }
    index += 1;
    if (value) values.push(value);
  }
  return [...new Set(values)];
}

function decryptStaticMegaPlay(enc: string, script: string): string | null {
  const encrypted = Buffer.from(enc, "base64url");
  if (!encrypted.length || encrypted.length % 16) return null;
  const literals = scriptStrings(script).filter((value) => Buffer.byteLength(value) > 0 && Buffer.byteLength(value) <= 32);
  const ivs = literals.filter((value) => Buffer.byteLength(value) === 16);
  for (const value of literals) {
    const key = Buffer.alloc(32);
    Buffer.from(value).copy(key);
    for (const iv of ivs) {
      try {
        const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(iv));
        const clear = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
        const parsed = JSON.parse(clear) as { file?: unknown; url?: unknown; sources?: { file?: unknown } | Array<{ file?: unknown }> };
        const first = Array.isArray(parsed.sources) ? parsed.sources[0]?.file : parsed.sources?.file;
        const candidate = parsed.file ?? parsed.url ?? first;
        if (typeof candidate === "string" && /^https:\/\//i.test(candidate)) return candidate;
      } catch { /* Try the next static key/IV pair. */ }
    }
  }
  return null;
}

async function extractVidplay(embed: URL): Promise<ExtractedSource[]> {
  const match = embed.pathname.match(/^\/(embed-[01])\/([^/]+)$/i);
  if (!match) return [];
  const endpoint = new URL("/" + match[1] + "/getSources", embed.origin);
  endpoint.searchParams.set("id", match[2]);
  const data = await anivexaJson<{ sources?: unknown }>(endpoint.href, {
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Referer: embed.href },
  });
  const values = Array.isArray(data.sources)
    ? data.sources.map((item) => typeof item === "string" ? item : item && typeof item === "object" ? (item as { file?: string; url?: string }).file ?? (item as { url?: string }).url : null)
    : typeof data.sources === "string" ? [data.sources] : [];
  return values.filter((value): value is string => typeof value === "string")
    .map((url) => ({ url, type: mediaType(url) })).filter((item): item is ExtractedSource => item.type !== null);
}

async function extractMegaPlay(embed: URL): Promise<ExtractedSource[]> {
  const page = await anivexaText(embed.href, { Accept: "text/html", Referer: embed.origin + "/" });
  const fileId = page.match(/\bdata-id=["']([^"']+)["']/i)?.[1];
  if (!fileId) return [];
  const scriptUrls = [...page.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map((match) => new URL(match[1], embed).href).filter((url) => isAnivexaUrlAllowed(url));
  const scripts = await Promise.all(scriptUrls.map((url) => anivexaText(url, { Accept: "text/javascript,*/*", Referer: embed.href }).catch(() => "")));
  const script = scripts.find((value) => /getSources/i.test(value) && /AES-CBC/i.test(value));
  if (!script) return [];
  const routes = scriptStrings(script).filter((value) => /^stream\/getSources[\w/-]*$/i.test(value)).sort((a, b) => a.length - b.length);
  const legacy = routes[0];
  const modern = routes.find((route) => route !== legacy && Boolean(legacy) && route.startsWith(legacy));
  if (!legacy && !modern) return [];

  const getSource = async (route: string): Promise<string | null> => {
    const endpoint = new URL(route, embed.origin);
    endpoint.searchParams.append("id", fileId);
    endpoint.searchParams.append("id", fileId);
    const data = await anivexaJson<{ sources?: { file?: string }; enc?: string }>(endpoint.href, {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Referer: embed.href },
    }).catch(() => null);
    const direct = data?.sources?.file;
    const decrypted = typeof data?.enc === "string" ? decryptStaticMegaPlay(data.enc, script) : null;
    const candidate = typeof direct === "string" ? direct : decrypted;
    if (!candidate) return null;
    // Dynamic HMAC signing is intentionally unsupported; never evaluate the embed's JavaScript.
    if (/\/[a-f0-9]{32}\/[a-f0-9]{32}\//i.test(candidate) && !/[?&]token=/i.test(candidate)) return null;
    return candidate;
  };

  const values = await Promise.all([modern, legacy].filter((value): value is string => Boolean(value)).map(getSource));
  return values.filter((value): value is string => Boolean(value))
    .map((url) => ({ url, type: mediaType(url) })).filter((item): item is ExtractedSource => item.type !== null);
}

export async function extractAniKotoEmbed(embedUrl: string, allowedStreams: Set<string>): Promise<ExtractedSource[]> {
  let embed: URL;
  try { embed = new URL(embedUrl); } catch { return []; }
  if (!isAnivexaUrlAllowed(embed.href, anivexaAllowedHosts())) return [];
  let extracted: ExtractedSource[] = [];
  if (/^play\.echovideo\.ru$/i.test(embed.hostname)) extracted = await extractVidplay(embed);
  else if (/^megaplay\./i.test(embed.hostname) && /\/stream\//i.test(embed.pathname)) extracted = await extractMegaPlay(embed);
  const seen = new Set<string>();
  return extracted.filter((source) => {
    if (!isAnivexaUrlAllowed(source.url, allowedStreams) || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

export function parseAniKotoDirectSource(value: string): ExtractedSource | null {
  const candidate = decodeFragment(value) ?? value;
  const type = mediaType(candidate);
  return type ? { url: candidate, type } : null;
}
