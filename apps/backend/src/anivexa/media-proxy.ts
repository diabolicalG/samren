import { safeFetch } from "./core/safe-fetch.js";
import { anivexaAllowedHosts, anivexaStreamAllowedHosts, isAnivexaUrlAllowed } from "./http.js";

const MAX_MEDIA_BYTES = 32 * 1024 * 1024;
const MEDIA_PATH = "/api/v1/anivexa/media";

function proxyUrl(target, referer) {
  const query = new URLSearchParams({ url: target });
  if (referer) query.set("referer", referer);
  return `${MEDIA_PATH}?${query.toString()}`;
}

function resolveResource(reference, base) {
  const value = String(reference ?? "").trim();
  if (!value || value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("#")) return null;
  try {
    const resolved = new URL(value, base);
    return resolved.protocol === "https:" ? resolved.toString() : null;
  } catch {
    return null;
  }
}

export function rewriteHlsManifest(manifest, manifestUrl, referer) {
  return String(manifest).split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (!trimmed.startsWith("#")) {
      const resolved = resolveResource(trimmed, manifestUrl);
      return resolved ? proxyUrl(resolved, referer) : line;
    }
    if (!/URI="/i.test(line)) return line;
    return line.replace(/URI="([^"]+)"/gi, (match, value) => {
      const resolved = resolveResource(value, manifestUrl);
      return resolved ? `URI="${proxyUrl(resolved, referer)}"` : match;
    });
  }).join("\n");
}

export function rewriteDashManifest(manifest, manifestUrl, referer) {
  const xml = String(manifest);
  let base = manifestUrl;
  const rootBase = xml.match(/<BaseURL(?:\s[^>]*)?>([^<]+)<\/BaseURL>/i);
  if (rootBase) {
    const resolvedBase = resolveResource(rootBase[1].trim(), manifestUrl);
    if (resolvedBase) base = resolvedBase;
  }
  let rewritten = xml.replace(/<BaseURL(?:\s[^>]*)?>[^<]*<\/BaseURL>/i, "");
  rewritten = rewritten.replace(/\b(media|initialization|sourceURL|href)="([^"]+)"/gi, (match, attribute, value) => {
    const resolved = resolveResource(value, base);
    return resolved ? `${attribute}="${proxyUrl(resolved, referer)}"` : match;
  });
  rewritten = rewritten.replace(/<Location>([^<]+)<\/Location>/gi, (match, value) => {
    const resolved = resolveResource(value.trim(), base);
    return resolved ? `<Location>${proxyUrl(resolved, referer)}</Location>` : match;
  });
  return rewritten;
}

export async function proxyAnivexaMedia(request, response) {
  const target = typeof request.query.url === "string" ? request.query.url : "";
  const refererValue = typeof request.query.referer === "string" ? request.query.referer : "";
  if (!target || target.length > 8192) {
    response.status(400).end("Invalid media URL");
    return;
  }
  const streamHosts = anivexaStreamAllowedHosts();
  if (!isAnivexaUrlAllowed(target, streamHosts)) {
    response.status(403).end("Media host is not allowlisted");
    return;
  }
  let referer;
  if (refererValue) {
    if (!isAnivexaUrlAllowed(refererValue, anivexaAllowedHosts())) {
      response.status(400).end("Invalid provider referer");
      return;
    }
    referer = refererValue;
  }
  const headers = new Headers({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
    Accept: "*/*",
  });
  const range = request.get("range");
  if (range && /^bytes=\d*-\d*$/.test(range)) headers.set("Range", range);
  if (referer) headers.set("Referer", referer);
  try {
    const upstream = await safeFetch(target, { method: request.method, headers }, [...streamHosts], MAX_MEDIA_BYTES);
    const contentType = upstream.headers.get("content-type") ?? "";
    const path = new URL(target).pathname.toLowerCase();
    const isHls = path.endsWith(".m3u8") || /mpegurl/i.test(contentType);
    const isDash = path.endsWith(".mpd") || /dash\+xml/i.test(contentType);
    if (!upstream.ok) {
      response.status(upstream.status);
      const contentRange = upstream.headers.get("content-range");
      if (contentRange) response.setHeader("Content-Range", contentRange);
      response.end(await upstream.arrayBuffer());
      return;
    }
    if (isHls || isDash) {
      const manifest = await upstream.text();
      const body = isHls
        ? rewriteHlsManifest(manifest, target, referer)
        : rewriteDashManifest(manifest, target, referer);
      response.status(200);
      response.setHeader("Content-Type", isHls ? "application/vnd.apple.mpegurl; charset=utf-8" : "application/dash+xml; charset=utf-8");
      response.setHeader("Cache-Control", "private, max-age=15");
      response.setHeader("Access-Control-Allow-Origin", request.get("origin") ?? "*");
      response.end(body);
      return;
    }
    response.status(upstream.status);
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
      const value = upstream.headers.get(name);
      if (value) response.setHeader(name, value);
    }
    response.setHeader("Cache-Control", "private, max-age=30");
    response.setHeader("Access-Control-Allow-Origin", request.get("origin") ?? "*");
    response.end(await upstream.arrayBuffer());
  } catch {
    response.status(502).end("Upstream media request failed");
  }
}
