# Phase 3 — Anivexa Provider Audit and Aggregation

**Audit date:** 2026-11-20  
**Implementation branch:** `phase-3-media-providers`  
**Reference repository:** `diabolicalG/Anime-streaming` (read-only)

## 1. Current provider inventory

The existing Samren branch registers the following provider adapters. “Registered” means the adapter is present in the current branch; it does not mean live playback has been verified or the code is cleared for release.

| Provider | Branch status | Known limitation |
|---|---|---|
| AnimeGG | Registered | Live playback/browser verification outstanding; source provenance remediation required |
| AniZone | Registered | Sub-only extraction; dub is fail-closed |
| AniKoto | Registered | MegaPlay runtime-HMAC path intentionally unsupported |
| KickAssAnime | Registered | Confidence-gated matching; live playback not verified |
| AniWaves | Registered | Existing adapter path; live playback not verified |
| ReAnime | Registered | Flixcloud-derived path; live playback not verified |
| AnimeOnsen | Registered | DASH/subtitle handling caveat; no bearer headers returned to browser |
| AnimeNoSub | Registered | Embed-only results are discarded |
| Ani.pm | Registered | Ordinary HTTPS only; anti-bot rejection is treated as provider failure |
| Senshi | Registered | Direct VidCloud HLS only; embed-only fallbacks are discarded |
| AnimeDunya | Registered | Shell/curl execution excluded; bounded HTTPS implementation |
| MKissa | Excluded | Reference implementation contains an embedded bearer credential; do not use it |

The provider inventory is subject to the provenance and security gates below. Do not advertise all 11 as available until each provider has a successful, separately recorded live smoke test.

## 2. Source provenance and licensing

The inspected Anime-streaming repository's `apps/anivexa-api` and identified upstream Anivexa API repository did not expose a LICENSE file at the inspected paths.

A comparison of current Samren files against the reference Anivexa source found:
- `apps/backend/src/anivexa/providers/animegg.js`: 217 of 218 non-empty Samren lines matched reference lines (100%).
- `apps/backend/src/anivexa/core/new-provider-utils.js`: 390 of 391 non-empty Samren lines matched reference lines (100%).
- `apps/backend/src/anivexa/extractors/vidplay.js`: exact file match.

These files are not cleared for distribution merely because they are in the Anime-streaming reference. Unless a compatible license or explicit permission is established, replace copied provider/extractor modules with clean-room implementations based on public behavior and protocol contracts. Preserve independent Samren code and required third-party notices.

The source also contains unsafe patterns that must remain excluded:
- `animedunya.js` uses shell command execution with a URL.
- `mkissa.js` contains a hard-coded bearer credential.
- Some handlers expose raw upstream diagnostics, cookies or request headers.
- The upstream aggregator uses wildcard CORS.
- Runtime code execution, provider-supplied script execution and browser/request impersonation are not approved.

## 3. Kuhi reference findings

The reference contains a TypeScript `KuhiProvider` client and provider contracts, plus an accessible Kuhi API v3 service source with an MIT license. The Kuhi README describes the service as experimental and not guaranteed reliable.

The reference Kuhi service shell also contains:
- Wildcard CORS.
- `/proxy_m3u8` and `/proxy_segment` routes that accept caller-supplied URLs.
- A demo HTML dashboard and third-party HLS script loading.

Do not copy those proxy routes or wildcard CORS. The new Samren service boundary is a loopback-only `services/kuhi-api` component exposing only provider search, episode discovery and extraction. Preserve its MIT license/attribution. All returned URLs must be validated and relayed using Samren's opaque session-bound media-resource contract.

The legacy `apps/api` Python gateway is not the Kuhi integration target and has been restored to its pre-Phase-3 state.

## 4. Aggregator and worker design already present

The current TypeScript Anivexa aggregator:
1. Queues provider extraction tasks in a bounded worker pool.
2. Runs within configured concurrency and queue limits.
3. Accepts only structurally valid, allowlisted HTTPS HLS/MP4/DASH results.
4. Retains pending provider tasks as fallback candidates for a short-lived session.
5. Uses provider circuit breakers and cooldowns.
6. Returns a session identifier and supports fallback/close operations.

The worker pool and sessions are process-local. This is a single-process boundary; no multi-instance or Redis-backed session guarantee is made.

## 5. Critical relay correction

The current media relay uses browser-facing `url` and `referer` query parameters. Although the server checks host allowlists and uses DNS-pinned HTTPS, the browser still chooses the upstream URL/path and the raw URL/referer appear in the browser-visible request.

This does not satisfy the approved “no user-controlled destination” rule.

Replace it with:
- Random opaque session/resource handles.
- Server-side storage of upstream URL, referer and allowed media kind.
- Resource registration only from validated provider results and parsed authorized manifests.
- Session-bound expiry/revocation.
- Strict host, HTTPS, port, DNS/IP and redirect validation at fetch time.
- No raw upstream URL, referer, cookie or private header in the browser response or query string.

## 6. Provider and relay security requirements

- Anivexa remains disabled by default.
- `ANIVEXA_ALLOWED_HOSTS` and `ANIVEXA_STREAM_ALLOWED_HOSTS` are separate, explicit and fail closed.
- Reject credentials in URLs, non-HTTPS schemes, disallowed ports, IP literals and private/reserved DNS results.
- Revalidate every redirect and pin outbound DNS to validated public addresses.
- Bound provider response sizes, manifest sizes, media stream sizes, timeouts and redirect counts.
- Add per-client rate limits to discovery, extraction, session creation, fallback and resource delivery.
- Cancel outstanding work when sessions close or expire.
- Never execute provider JavaScript or shell commands.
- Never return provider cookies, authorization headers, raw diagnostic payloads or raw upstream URLs to the browser.
- Validate provider subtitle content as WebVTT or safely convert supported SRT before exposing a native HTML track.

## 7. Verification status

Existing automated tests cover worker concurrency, queue saturation, circuit breakers, first-valid-provider selection, stream-host rejection, fallback selection, HLS/DASH manifest rewriting and mocked player-engine error handling.

Still outstanding:
- Clean-room/licensed source provenance for every retained adapter.
- Real-browser playback tests for MP4, HLS and DASH.
- Live smoke tests for each provider, recorded separately from normal CI.
- Seeking, buffering, source switching and subtitle synchronization in real browsers.
- Opaque resource-handle authorization, expiry, session revocation and arbitrary-URL rejection tests.
- Per-client rate-limit and cancellation tests.

A passing jsdom test or provider registration is not proof of playable media.
