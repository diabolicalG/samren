import type { Request, Response } from "express";
import type { IncomingHttpHeaders } from "node:http";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "../config/env.js";
import { safeFetch, safeFetchStream } from "./core/safe-fetch.js";
import { anivexaAllowedHosts, anivexaStreamAllowedHosts, isAnivexaUrlAllowed } from "./http.js";

const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_MEDIA_BYTES = 512 * 1024 * 1024;
const MEDIA_PATH = "/api/v1/anivexa/media";

function proxyUrl(target: string, referer?: string, xml = false): string {
  const encodedTarget = encodeURIComponent(target).replace(/%24(Number(?:%25\d+d)?|Time|RepresentationID|Bandwidth)%24/g, function (_match, token) {
    return "$" + token.replace("%25", "%") + "$";
  });
  const query = "url=" + encodedTarget + (referer ? "&referer=" + encodeURIComponent(referer) : "");
  const value = MEDIA_PATH + "?" + query;
  return xml ? value.replace(/&/g, "&amp;") : value;
}

function resolveResource(reference: string, base: string): string | null {
  const value = String(reference ?? "").trim();
  if (!value || value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("#")) return null;
  try {
    const resolved = new URL(value, base);
    return resolved.protocol === "https:" ? resolved.toString() : null;
  } catch {
    return null;
  }
}

export function rewriteHlsManifest(manifest: string, manifestUrl: string, referer?: string): string {
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

type XmlPart = XmlNode | string;
type XmlNode = { name: string; opening: string; closing: string; children: XmlPart[]; selfClosing: boolean };

function decodeXml(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
    const lower = entity.toLowerCase();
    if (named[lower]) return named[lower];
    const hex = lower.startsWith("&#x");
    const number = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return Number.isFinite(number) && number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
  });
}

function localXmlName(value: string): string {
  return value.split(":").pop()?.toLowerCase() ?? value.toLowerCase();
}

function parseXmlParts(xml: string): XmlPart[] {
  const root: XmlNode = { name: "#root", opening: "", closing: "", children: [], selfClosing: false };
  const stack = [root];
  const tokens = xml.match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<[^>]+>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (token.startsWith("</")) {
      const rawName = token.match(/^<\/\s*([^\s>]+)/)?.[1];
      const name = rawName ? localXmlName(rawName) : undefined;
      if (stack.length > 1 && stack[stack.length - 1]?.name === name) {
        const node = stack.pop();
        if (node) node.closing = token;
      } else {
        stack[stack.length - 1]?.children.push(token);
      }
      continue;
    }
    if (token.startsWith("<") && !token.startsWith("<!--") && !token.startsWith("<!") && !token.startsWith("<?")) {
      const rawName = token.match(/^<\s*([^\s/>]+)/)?.[1];
      const name = rawName ? localXmlName(rawName) : undefined;
      if (!name) {
        stack[stack.length - 1]?.children.push(token);
        continue;
      }
      const selfClosing = /\/\s*>$/.test(token);
      const node: XmlNode = { name, opening: token, closing: "", children: [], selfClosing };
      stack[stack.length - 1]?.children.push(node);
      if (!selfClosing) stack.push(node);
      continue;
    }
    stack[stack.length - 1]?.children.push(token);
  }
  return root.children;
}

function nodeText(node: XmlNode): string {
  return node.children.map((part) => typeof part === "string" ? part : nodeText(part)).join("");
}

function resolveTemplateResource(reference: string, base: string): string | null {
  const tokens: string[] = [];
  const protectedValue = reference.replace(/\$(?!\$)[A-Za-z][A-Za-z0-9]*(?:%0\d+d)?\$/g, (token) => {
    const marker = "SAMREN_DASH_TOKEN_" + tokens.length + "_END";
    tokens.push(token);
    return marker;
  });
  const resolved = resolveResource(decodeXml(protectedValue), base);
  if (!resolved) return null;
  return resolved.replace(/SAMREN_DASH_TOKEN_(\d+)_END/g, (_match, index) => tokens[Number(index)] ?? "");
}

function rewriteDashParts(parts: XmlPart[], inheritedBase: string, referer?: string): string {
  return parts.map((part) => {
    if (typeof part === "string") return part;
    if (part.name === "baseurl") return "";
    let base = inheritedBase;
    const xmlBase = part.opening.match(/\bxml:base\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (xmlBase) base = resolveResource(decodeXml(xmlBase), base) ?? base;
    const baseNode = part.children.find((child): child is XmlNode => typeof child !== "string" && child.name === "baseurl");
    if (baseNode) base = resolveResource(decodeXml(nodeText(baseNode)), base) ?? base;

    const rewrittenOpening = part.opening.replace(/([A-Za-z_:][\w:.-]*)(\s*=\s*)(["'])(.*?)\3/g, (match, attribute: string, separator: string, quote: string, rawValue: string) => {
      const name = attribute.toLowerCase();
      if (!["media", "initialization", "index", "bitstreamswitching", "sourceurl", "href", "xlink:href"].includes(name)) return match;
      const resolved = resolveTemplateResource(rawValue, base);
      return resolved ? attribute + separator + quote + proxyUrl(resolved, referer, true) + quote : match;
    });
    if (part.name === "location") {
      const location = resolveResource(decodeXml(nodeText(part)), base);
      if (location) {
        const tagName = part.opening.match(/^<\s*([^\s/>]+)/)?.[1] ?? "Location";
        return "<" + tagName + ">" + proxyUrl(location, referer, true) + "</" + tagName + ">";
      }
    }
    const children = rewriteDashParts(part.children, base, referer);
    return rewrittenOpening + children + (part.selfClosing ? "" : part.closing);
  }).join("");
}

export function rewriteDashManifest(manifest: string, manifestUrl: string, referer?: string): string {
  return rewriteDashParts(parseXmlParts(String(manifest)), manifestUrl, referer);
}

export function detectNestedManifestType(contentType: string, prefix: Buffer): "hls" | "dash" | "" {
  if (/mpegurl/i.test(contentType)) return "hls";
  if (/dash\+xml/i.test(contentType)) return "dash";
  const text = prefix.toString("utf8", 0, 4096).replace(/^\uFEFF/, "").trimStart();
  if (text.startsWith("#EXTM3U")) return "hls";
  if (/<(?:[A-Za-z_][\w.-]*:)?MPD(?:\s|>)/i.test(text)) return "dash";
  return "";
}

function forwardHeaders(response: Response, headers: IncomingHttpHeaders): void {
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
    const value = headers[name];
    if (value) response.setHeader(name, value);
  }
  response.setHeader("Cache-Control", "private, max-age=30");
}

export async function proxyAnivexaMedia(request: Request, response: Response): Promise<void> {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).end("Anivexa playback is disabled");
    return;
  }
  const target = typeof request.query.url === "string" ? request.query.url : "";
  const refererValue = typeof request.query.referer === "string" ? request.query.referer : "";
  const kind = typeof request.query.kind === "string" ? request.query.kind : "";
  if (!target || target.length > 8192 || !["", "hls", "mp4", "dash", "vtt"].includes(kind)) {
    response.status(400).end("Invalid media URL");
    return;
  }
  const streamHosts = anivexaStreamAllowedHosts();
  if (!isAnivexaUrlAllowed(target, streamHosts)) {
    response.status(403).end("Media host is not allowlisted");
    return;
  }
  let referer: string | undefined;
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
    if (request.method === "HEAD" && !manifestType) {
      const upstream = await safeFetchStream(target, { method: "HEAD", headers }, [...streamHosts], {
        maxBytes: MAX_MEDIA_BYTES,
        timeoutMs: 10_000,
      });
      response.status(upstream.status);
      forwardHeaders(response, upstream.headers);
      response.end();
      return;
    }
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
      if (request.method === "HEAD") {
        response.setHeader("Content-Length", String(Buffer.byteLength(body)));
        response.end();
      } else {
        response.end(body);
      }
      return;
    }

    const upstream = await safeFetchStream(target, { method: "GET", headers }, [...streamHosts], {
      maxBytes: MAX_MEDIA_BYTES,
      timeoutMs: 60_000,
    });
    const upstreamType = String(upstream.headers["content-type"] ?? "");
    const iterator = upstream.body[Symbol.asyncIterator]();
    const prefixChunks: Buffer[] = [];
    let prefixBytes = 0;
    let nestedManifestType = detectNestedManifestType(upstreamType, Buffer.alloc(0));
    while (!nestedManifestType && prefixBytes < 4096) {
      const nextChunk = await iterator.next();
      if (nextChunk.done) break;
      const bytes = Buffer.from(nextChunk.value);
      prefixChunks.push(bytes);
      prefixBytes += bytes.length;
      nestedManifestType = detectNestedManifestType(upstreamType, Buffer.concat(prefixChunks));
    }
    if (nestedManifestType && prefixChunks.length === 0) {
      const firstChunk = await iterator.next();
      if (!firstChunk.done) prefixChunks.push(Buffer.from(firstChunk.value));
    }
    if (nestedManifestType) {
      const chunks = [...prefixChunks];
      let total = prefixBytes;
      while (true) {
        const nextChunk = await iterator.next();
        if (nextChunk.done) break;
        const bytes = Buffer.from(nextChunk.value);
        total += bytes.length;
        if (total > MAX_MANIFEST_BYTES) throw new Error("Nested media manifest exceeded the size limit");
        chunks.push(bytes);
      }
      const manifest = Buffer.concat(chunks).toString("utf8");
      const body = nestedManifestType === "hls"
        ? rewriteHlsManifest(manifest, target, referer)
        : rewriteDashManifest(manifest, target, referer);
      response.status(upstream.status);
      response.setHeader("Content-Type", nestedManifestType === "hls" ? "application/vnd.apple.mpegurl; charset=utf-8" : "application/dash+xml; charset=utf-8");
      response.setHeader("Cache-Control", "private, max-age=15");
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
    const replay = Readable.from((async function* () {
      for (const prefixChunk of prefixChunks) yield prefixChunk;
      while (true) {
        const nextChunk = await iterator.next();
        if (nextChunk.done) return;
        yield Buffer.from(nextChunk.value);
      }
    })());
    await pipeline(replay, sizeLimit, response);
  } catch {
    if (!response.headersSent) response.status(502).end("Upstream media request failed");
    else response.destroy();
  }
}
