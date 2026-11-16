import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";

const DEFAULT_HOSTS = [
  "graphql.anilist.co", "anilist.co", "arm.haglund.dev", "api.ani.zip",
  "www.animegg.org", "animegg.org", "anizone.to", "aniwaves.ru",
  "www.animeonsen.xyz", "animeonsen.xyz", "reanime.to", "flixcloud.cc",
  "nova.upn.one", "vidplay.site", "vidplay.online", "vidmoly.net",
  "animenosub.to", "anikototv.to", "mapper.nekostream.site",
  "mkissa.to", "api.mkissa.net", "cdn.mkissa.net", "ani.pm", "embed.settlar.io",
];

function configuredHosts() {
  const configured = String(process.env.ANIVEXA_ALLOWED_HOSTS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return [...new Set([...DEFAULT_HOSTS, ...configured])];
}

function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168))
      || (a === 192 && b === 88 && c === 99)
      || (a === 198 && (b === 18 || b === 19 || b === 51))
      || (a === 203 && b === 0));
  }
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    if (value.startsWith("::ffff:")) return isPublicAddress(value.slice(7));
    // Permit only global-unicast 2000::/3; exclude documentation and special-use ranges.
    if (!/^2[0-9a-f]{3}:/.test(value)) return false;
    if (value.startsWith("2001:db8:") || value.startsWith("2001:0000:") || value.startsWith("2001:2:") || value.startsWith("2001:10:")) return false;
    return true;
  }
  return false;
}

function assertAllowedUrl(url, allowed = configuredHosts()) {
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Anivexa outbound URL is not permitted");
  }
  const host = url.hostname.toLowerCase().replace(/\\.$/, "");
  if (!allowed.some((item) => host === item || host.endsWith("." + item))) {
    throw new Error("Anivexa outbound host is not allowlisted");
  }
  return host;
}

export function createPinnedLookup(addresses) {
  if (!Array.isArray(addresses) || !addresses.length) throw new Error("Anivexa outbound host has no validated addresses");
  const pinned = addresses.map(({ address, family }) => ({ address, family: family || isIP(address) }));
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, pinned);
    else callback(null, pinned[0].address, pinned[0].family);
  };
}

async function resolvePublicAddresses(host) {
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Anivexa outbound host resolved to a non-public address");
  }
  return addresses;
}

async function pinnedHttpsRequest(url, { method, headers, body, signal }, addresses, maxBytes) {
  if (body !== undefined && body !== null
    && typeof body !== "string" && !Buffer.isBuffer(body) && !(body instanceof Uint8Array)) {
    throw new Error("Anivexa safe transport only accepts buffered request bodies");
  }
  const requestHeaders = Object.fromEntries(headers.entries());
  delete requestHeaders.host;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      headers: requestHeaders,
      lookup: isIP(url.hostname) ? undefined : createPinnedLookup(addresses),
      agent: false,
      signal,
    }, async (res) => {
      try {
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > maxBytes) {
          res.destroy();
          throw new Error("Anivexa provider response exceeded the size limit");
        }
        const chunks = [];
        let total = 0;
        for await (const chunk of res) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += bytes.length;
          if (total > maxBytes) {
            res.destroy();
            throw new Error("Anivexa provider response exceeded the size limit");
          }
          chunks.push(bytes);
        }
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) for (const item of value) responseHeaders.append(name, item);
          else if (value !== undefined) responseHeaders.set(name, String(value));
        }
        const status = res.statusCode ?? 502;
        resolve(new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), {
          status,
          statusText: res.statusMessage,
          headers: responseHeaders,
        }));
      } catch (error) {
        reject(error);
      }
    });
    req.once("error", reject);
    if (body !== undefined && body !== null) req.write(body);
    req.end();
  });
}

export async function safeFetch(input, init = {}, allowed = configuredHosts()) {
  let url = new URL(input instanceof Request ? input.url : String(input));
  let method = init.method ?? (input instanceof Request ? input.method : "GET");
  let body = init.body ?? (input instanceof Request ? input.body : undefined);
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  const maxBytes = 5 * 1024 * 1024;

  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const host = assertAllowedUrl(url, allowed);
    // Resolve once, reject mixed public/private answers, and pin the TLS socket to this exact result.
    const addresses = await resolvePublicAddresses(host);
    const timeout = AbortSignal.timeout(10_000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const response = await pinnedHttpsRequest(url, { method, headers, body, signal }, addresses, maxBytes);

    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirects === 4) {
      await response.body?.cancel();
      throw new Error("Anivexa provider redirect could not be safely followed");
    }
    const next = new URL(location, url);
    assertAllowedUrl(next, allowed);
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
