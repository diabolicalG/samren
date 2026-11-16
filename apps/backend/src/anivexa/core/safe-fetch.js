import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const nativeFetch = globalThis.fetch.bind(globalThis);
const DEFAULT_HOSTS = [
  "graphql.anilist.co", "anilist.co", "arm.haglund.dev", "api.ani.zip",
  "www.animegg.org", "animegg.org", "anizone.to", "aniwaves.ru",
  "www.animeonsen.xyz", "animeonsen.xyz", "reanime.to", "flixcloud.cc",
  "nova.upn.one", "vidplay.site", "vidplay.online", "vidmoly.net",
  "animenosub.to", "anikototv.to", "mapper.nekostream.site",
  "mkissa.to", "api.mkissa.net", "cdn.mkissa.net", "ani.pm", "embed.settlar.io",
];

function allowedHosts() {
  const configured = String(process.env.ANIVEXA_ALLOWED_HOSTS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return [...new Set([...DEFAULT_HOSTS, ...configured])];
}

function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168)) || (a === 100 && b >= 64 && b <= 127)
      || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
  }
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    if (value.startsWith("::ffff:")) return isPublicAddress(value.slice(7));
    return !(value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd")
      || /^fe[89ab]/.test(value) || value.startsWith("ff"));
  }
  return false;
}

function assertAllowedUrl(url) {
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Anivexa outbound URL is not permitted");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!allowedHosts().some((allowed) => host === allowed || host.endsWith("." + allowed))) {
    throw new Error("Anivexa outbound host is not allowlisted");
  }
  return host;
}

async function assertPublicDns(host) {
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new Error("Anivexa outbound address is not public");
    return;
  }
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
    throw new Error("Anivexa outbound host resolved to a non-public address");
  }
}

function limitResponse(response, maxBytes) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) {
    void response.body?.cancel();
    throw new Error("Anivexa provider response exceeded the size limit");
  }
  if (!response.body) return response;
  let total = 0;
  const body = response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new Error("Anivexa provider response exceeded the size limit");
      controller.enqueue(chunk);
    },
  }));
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export async function safeFetch(input, init = {}) {
  let url = new URL(input instanceof Request ? input.url : String(input));
  let method = init.method ?? (input instanceof Request ? input.method : "GET");
  let body = init.body ?? (input instanceof Request ? input.body : undefined);
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  const maxBytes = 10 * 1024 * 1024;

  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const host = assertAllowedUrl(url);
    await assertPublicDns(host);
    const timeout = AbortSignal.timeout(10_000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const response = await nativeFetch(url, { ...init, method, body, headers, redirect: "manual", signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) return limitResponse(response, maxBytes);

    const location = response.headers.get("location");
    if (!location || redirects === 4) {
      await response.body?.cancel();
      throw new Error("Anivexa provider redirect could not be safely followed");
    }
    const next = new URL(location, url);
    assertAllowedUrl(next);
    await response.body?.cancel();
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
      method = "GET";
      body = undefined;
      headers.delete("content-length");
      headers.delete("content-type");
    }
    url = next;
  }
  throw new Error("Anivexa provider redirect limit exceeded");
}
