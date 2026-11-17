import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { safeFetch, safeFetchStream } from "./core/safe-fetch.js";
import { anivexaAllowedHosts, anivexaStreamAllowedHosts, isAnivexaUrlAllowed } from "./http.js";

const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_MEDIA_BYTES = 512 * 1024 * 1024;
const MEDIA_PATH = "/api/v1/anivexa/media";

function proxyUrl(target, referer, xml = false) {
  const encodedTarget = encodeURIComponent(target).replace(/%24(Number|Time|RepresentationID|Bandwidth)%24/g, function (_match, token) {
    return "$" + token + "$";
  });
  const query = "url=" + encodedTarget + (referer ? "&referer=" + encodeURIComponent(referer) : "");
  const value = MEDIA_PATH + "?" + query;
  return xml ? value.replace(/&/g, "&amp;") : value;
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
    return line.replace(/URI="([^"]+)"/gi, function (match, value) {
      const resolved = resolveResource(value, manifestUrl);
      return resolved ? 'URI="' + proxyUrl(resolved, referer) + '"' : match;
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
  rewritten = rewritten.replace(/\b(media|initialization|sourceURL|href)="([^"]+)"/gi, function (match, attribute, value) {
    const resolved = resolveResource(value, base);
    return resolved ? attribute + '="' + proxyUrl(resolved, referer, true) + '"' : match;
  });
  rewritten = rewritten.replace(/<Location>([^<]+)<\/Location>/gi, function (match, value) {
    const resolved = resolveResource(value.trim(), base);
    return resolved ? "<Location>" + proxyUrl(resolved, referer, true) + "</Location>" : match;
  });
  return rewritten;
}

function forwardHeaders(response, headers) {
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
    const value = headers[name];
    if (value) response.setHeader(name, value);
  }
  response.setHeader("Cache-Control", "private, max-age=30");
  response.setHeader("Access-Control-Allow-Origin", "*");
}

export async function proxyAnivexaMedia(request, response) {
  const target = typeof request.query.url === "string" ? request.query.url : "";
  const refererValue = typeof request.query.referer === "string" ? request.query.referer : "";
  const kind = typeof request.query.kind === "string" ? request.query.kind : "";
  if (!target || target.length > 8192 || !["", "hls", "dash", "vtt"].includes(kind)) {
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
    if (!isAnivexaUrlAllowed(refererValue, new Set([...anivexaAllowedHosts(), ...streamHosts]))) {
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
  const pathname = new URL(target).pathname.toLowerCase();
  const manifestType = kind === "hls" || kind === "dash"
    ? kind
    : pathname.endsWith(".m3u8") ? "hls" : pathname.endsWith(".mpd") ? "dash" : "";
  try {
    if (manifestType) {
      const upstream = await safeFetch(target, { method: "GET", headers }, [...streamHosts], MAX_MANIFEST_BYTES);
      if (!upstream.ok) {
        response.status(upstream.status);
        const contentRange = upstream.headers.get("content-range");
        if (contentRange) response.setHeader("Content-Range", contentRange);
        response.end(await upstream.arrayBuffer());
        return;
      }
      const manifest = await upstream.text();
      const body = manifestType === "hls"
        ? rewriteHlsManifest(manifest, target, referer)
        : rewriteDashManifest(manifest, target, referer);
      response.status(200);
      response.setHeader("Content-Type", manifestType === "hls" ? "application/vnd.apple.mpegurl; charset=utf-8" : "application/dash+xml; charset=utf-8");
      response.setHeader("Cache-Control", "private, max-age=15");
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.end(body);
      return;
    }

    const upstream = await safeFetchStream(target, { method: "GET", headers }, [...streamHosts], {
      maxBytes: MAX_MEDIA_BYTES,
      timeoutMs: 60_000,
    });
    const upstreamType = String(upstream.headers["content-type"] ?? "");
    const nestedManifestType = /mpegurl/i.test(upstreamType) ? "hls" : /dash\+xml/i.test(upstreamType) ? "dash" : "";
    if (nestedManifestType) {
      const chunks = [];
      let total = 0;
      for await (const chunk of upstream.body) {
        total += chunk.length;
        if (total > MAX_MANIFEST_BYTES) throw new Error("Nested media manifest exceeded the size limit");
        chunks.push(Buffer.from(chunk));
      }
      const manifest = Buffer.concat(chunks).toString("utf8");
      const body = nestedManifestType === "hls"
        ? rewriteHlsManifest(manifest, target, referer)
        : rewriteDashManifest(manifest, target, referer);
      response.status(upstream.status);
      response.setHeader("Content-Type", nestedManifestType === "hls" ? "application/vnd.apple.mpegurl; charset=utf-8" : "application/dash+xml; charset=utf-8");
      response.setHeader("Cache-Control", "private, max-age=15");
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.end(body);
      return;
    }
    response.status(upstream.status);
    forwardHeaders(response, upstream.headers);
    let sent = 0;
    const sizeLimit = new Transform({
      transform(chunk, _encoding, callback) {
        sent += chunk.length;
        if (sent > upstream.maxBytes) callback(new Error("Anivexa media response exceeded the size limit"));
        else callback(null, chunk);
      },
    });
    await pipeline(upstream.body, sizeLimit, response);
  } catch {
    if (!response.headersSent) response.status(502).end("Upstream media request failed");
    else response.destroy();
  }
}
