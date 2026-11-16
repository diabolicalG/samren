import { env } from "../config/env.js";
import { safeFetch } from "./core/safe-fetch.js";

export function anivexaAllowedHosts(): Set<string> {
  return new Set(env.ANIVEXA_ALLOWED_HOSTS.split(",").map((host) => host.trim().toLowerCase().replace(/^\\.+|\\.+$/g, "")).filter(Boolean));
}

export function anivexaStreamAllowedHosts(): Set<string> {
  return new Set(env.ANIVEXA_STREAM_ALLOWED_HOSTS.split(",").map((host) => host.trim().toLowerCase().replace(/^\\.+|\\.+$/g, "")).filter(Boolean));
}

export function isAnivexaUrlAllowed(value: string, allowed = anivexaAllowedHosts()): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\\.$/, "");
    if (url.protocol !== "https:" || !host || url.username || url.password || !allowed.size) return false;
    if (host === "localhost" || host.endsWith(".localhost") || /^\\d+(?:\\.\\d+){3}$/.test(host) || host.includes(":")) return false;
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
  if (!isAnivexaUrlAllowed(input, allowed)) throw new Error("Anivexa request host is not allowlisted");
  return safeFetch(input, init, [...allowed]);
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
