import { env } from "../config/env.js";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;

export function anivexaAllowedHosts(): Set<string> {
  return new Set(env.ANIVEXA_ALLOWED_HOSTS.split(",").map((host) => host.trim().toLowerCase().replace(/^\.+|\.+$/g, "")).filter(Boolean));
}

export function anivexaStreamAllowedHosts(): Set<string> {\n  return new Set(env.ANIVEXA_STREAM_ALLOWED_HOSTS.split(",").map((host) => host.trim().toLowerCase().replace(/^\\.+|\\.+$/g, "")).filter(Boolean));\n}\n\nexport function isAnivexaUrlAllowed(value: string, allowed = anivexaAllowedHosts()): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || !host || url.username || url.password || !allowed.size) return false;
    if (host === "localhost" || host.endsWith(".localhost") || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":")) return false;
    return [...allowed].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export async function anivexaFetch(
  input: string,
  init: RequestInit = {},
  allowed = anivexaAllowedHosts(),
): Promise<Response> {
  let current = input;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!isAnivexaUrlAllowed(current, allowed)) throw new Error("Anivexa request host is not allowlisted");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(current, { ...init, redirect: "manual", signal: controller.signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirects === MAX_REDIRECTS) throw new Error("Anivexa redirect limit exceeded");
        current = new URL(location, current).href;
        continue;
      }

      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > MAX_RESPONSE_BYTES) {
        await response.body?.cancel();
        throw new Error("Anivexa response exceeded the size limit");
      }
      if (!response.body) return response;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            throw new Error("Anivexa response exceeded the size limit");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Anivexa redirect limit exceeded");
}

export async function anivexaReadText(response: Response): Promise<string> {
  return response.text();
}

export async function anivexaText(url: string, headers: HeadersInit = {}): Promise<string> {
  const response = await anivexaFetch(url, { headers });
  if (!response.ok) throw new Error(`Anivexa upstream returned HTTP ${response.status}`);
  return anivexaReadText(response);
}

export async function anivexaJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await anivexaFetch(url, init);
  if (!response.ok) throw new Error(`Anivexa upstream returned HTTP ${response.status}`);
  return JSON.parse(await anivexaReadText(response)) as T;
}
