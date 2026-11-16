# Phase 3 — Anivexa Provider Audit and Aggregation

**Audit date:** 2026-11-16  
**Implementation branch:** `phase-3-media-providers`  
**Reference repository:** `diabolicalG/Anime-streaming` (read-only)

## Provider decisions

| Provider | Status | Integration notes |
|---|---|---|
| AnimeGG | Integrated | Native TypeScript adapter; episode discovery and stream extraction |
| AniZone | Integrated | Native TypeScript adapter; static Vidstack payload parsing |
| AniKoto | Integrated | Native TypeScript adapter; direct, Vidplay and static MegaPlay route parsing |
| KickAssAnime | Integrated | Native TypeScript adapter; confidence-gated matching and fixed HLS CDN |
| AniWaves | Integrated | Existing provider module exposed through a typed internal adapter; direct extracted streams only |
| ReAnime | Integrated | Existing provider module exposed through a typed internal adapter; Flixcloud-derived direct streams only |
| AnimeOnsen | Integrated with playback caveat | Existing authenticated API adapter; DASH URL and allowlisted subtitles; no bearer headers returned to clients |
| AnimeNoSub | Integrated | Static HTML/AJAX parser and registered safe extractors; embed-only results are discarded by the aggregator |
| Ani.pm | Integrated with transport caveat | Provider logic uses the compatibility transport backed by ordinary safe HTTPS; no TLS/browser impersonation is performed, so anti-bot rejection is treated as provider failure |
| Senshi | Integrated with transport caveat | Provider logic uses ordinary safe HTTPS; direct VidCloud HLS sources only; embed-only fallbacks are discarded |
| AnimeDunya | Rewritten and integrated | Removed upstream shell/curl execution and replaced it with bounded safe HTTPS requests to the fixed AnimeDunya host |
| MKissa | EXCLUDED | Upstream source contains an embedded bearer credential. It is not copied, used, or exposed; do not enable without a clean credential-free integration design |

## Safe extractor policy

- Registered direct extractors: Byse, DataSV, Nova, Vidplay, Vidmoly and Flixcloud.
- MegaPlay's upstream runtime-HMAC extractor uses `vm.runInNewContext` to derive a signing key. It is deliberately not registered. AniKoto's static MegaPlay route parsing remains available where the key and IV are statically recoverable.
- Embed URLs are not considered playable results by the aggregator. It accepts only allowlisted HTTPS HLS, MP4 or DASH sources.
- Provider-returned subtitles are independently checked against `ANIVEXA_STREAM_ALLOWED_HOSTS`.
- No provider JavaScript is executed by the new static extractor registry. No shell execution, embedded provider bearer credentials, or browser impersonation dependency is added.

## Aggregator and worker design

The native Anivexa aggregator registers the 11 integrated providers above (excluding MKissa). For an episode/audio request:

1. It queues one extraction task per registered provider in a bounded worker pool.
2. Workers run concurrently up to `ANIVEXA_WORKER_CONCURRENCY`; excess tasks wait in a bounded queue.
3. The first task to return a structurally valid, allowlisted HTTPS HLS/MP4/DASH source wins. HTTP success, embed URLs and untrusted media URLs do not win.
4. Other provider tasks continue and their promises remain available as fallback candidates for the same short-lived playback session.
5. The player reports the currently failing provider to the fallback endpoint. The aggregator selects the first other successful provider; providers still running can finish and win the fallback race.
6. Per-provider circuit breakers open after repeated extraction failures and cool down before retrying.

### API

- `GET /api/v1/anivexa/aggregate/:anilistId/:episode?audio=sub|dub` — starts parallel provider workers and returns the first validated playable stream plus a session ID.
- `POST /api/v1/anivexa/aggregate/:sessionId/fallback` with `{"provider":"<failed-provider-id>"}` — marks the active provider failed and returns the next validated provider stream.
- `DELETE /api/v1/anivexa/aggregate/:sessionId` — closes a session.
- `GET /api/v1/anivexa/aggregate/providers` — reports worker queue and provider circuit status.

### Worker configuration

- `ANIVEXA_WORKER_CONCURRENCY`: concurrent extraction tasks (default 11, one per integrated provider; max 16).
- `ANIVEXA_WORKER_QUEUE_MAX`: waiting queue capacity (default 64, max 512).
- `ANIVEXA_PROVIDER_FAILURE_THRESHOLD`: failures before circuit-open (default 3).
- `ANIVEXA_PROVIDER_COOLDOWN_MS`: circuit cooldown (default 30000 ms).

The current worker pool and playback-session store are in-process and memory-backed. They are bounded and suitable for the current single-process API deployment, but are not yet a distributed BullMQ/Redis worker system. Multi-instance deployment requires shared Redis-backed session/circuit state and coordinated workers. The backend fallback endpoint is implemented; automatic switching still requires the frontend player to call it when HLS/media playback errors occur.

## Configuration and safety

- Anivexa remains disabled by default.
- `ANIVEXA_ALLOWED_HOSTS` must contain exact verified upstream/API hostnames needed by enabled providers.
- `ANIVEXA_STREAM_ALLOWED_HOSTS` must contain exact verified CDN/media hostnames needed by enabled providers.
- AnimeOnsen API/search origins use their separate configured allowlists.
- Empty allowlists fail closed for the native TypeScript adapters.
- DNS-pinning expansion remains deferred. No new DNS-related work is part of the aggregator.

## Verification gates

- Unit tests cover worker concurrency, bounded queue saturation, circuit-breaker behavior, first-valid-provider selection, stream-host rejection, and playback fallback selection.
- CI must pass lint, TypeScript typecheck, backend/frontend/Python tests and production builds before the aggregation layer is considered verified.
- Live provider availability, source freshness, browser playback, seek behavior, subtitle rendering and automatic frontend fallback remain separate verification gates.
