import { safeFetch } from "./safe-fetch.js";

/**
 * Compatibility transport for provider adapters that historically requested
 * browser impersonation. This implementation deliberately performs ordinary
 * HTTPS requests only; it does not spoof TLS fingerprints or retain sessions.
 * Providers that require impersonation fail closed and are skipped by the
 * aggregate worker rather than introducing a second transport dependency.
 */
export async function wreqFetch(input, options = {}) {
  const { session: _session, browser: _browser, os: _os, ...request } = options;
  return safeFetch(input, request);
}
