# Phase 3 — Remaining Anivexa Provider Audit

**Audit date:** 2026-11-16  
**Implementation branch:** `phase-3-media-providers`  
**Reference repository:** `diabolicalG/Anime-streaming` (read-only)

## Audit boundaries

This audit covers the Anivexa providers not yet exposed by Samren's native TypeScript Anivexa router. Existing AnimeGG, AniZone and AniKoto adapters remain unchanged. The separate Kuhi/Python provider integrations are not treated as Anivexa router implementations.

## Provider decisions

| Provider | Decision | Evidence / reason |
|---|---|---|
| KickAssAnime (KAA) | SELECTED — implement next | Fixed HTTPS API origin (`kaa.lt`), structured JSON search/show/episode/server responses, and a fixed HLS CDN URL assembled from a bounded server ID. No browser automation, request impersonation, provider JavaScript execution or embedded credential is required for the basic adapter. |
| AnimeNoSub | DEFER | WordPress AJAX search and HTML episode parsing are feasible, but watch resolution depends on multiple dynamic third-party embed hosts and extractor behavior. Needs a separate host-by-host extractor audit before implementation. |
| Ani.pm | DEFER | The upstream implementation uses `wreq-js` browser/request impersonation and a separate Settlar embed-session service. Do not add those dependencies without a demonstrated need and a dedicated transport/security review. |
| Senshi | DEFER | The upstream implementation uses `wreq-js` and returns dynamic VidCloud, StreamNin and FileMoon URLs plus subtitle URLs. Requires a provider-specific transport and credential/header review. |
| AnimeDunya | EXCLUDE AS-IS | Upstream constructs and executes a shell command from URL data. Do not port shell execution. A clean-room adapter would require a separate design. |
| MKissa | EXCLUDE AS-IS | Upstream source contains an embedded bearer credential. Do not copy or use it. |
| AnimeOnsen | SECURITY-HARDENED, NOT ROUTED | Dynamic authenticated API/search origins have explicit allowlists and credentials are not returned to clients. Playback still needs a safe server-side authorization design. |
| AniWaves / ReAnime | EXISTING SOURCE PORTS, NOT SELECTED | Samren already contains source modules, but they are not exposed through the current native Anivexa router. Revisit route integration only after confirming their contracts and safe stream behavior. |

## KickAssAnime implementation contract

- Use only the fixed HTTPS API origin `https://kaa.lt` and AniList GraphQL origin `https://graphql.anilist.co`, both subject to `ANIVEXA_ALLOWED_HOSTS`.
- Use the existing Anivexa safe HTTP transport. Do not add dependencies, browser automation, request impersonation, or a separate proxy.
- Match AniList entries using title variants, year and format signals. Reject low-confidence or ambiguous matches rather than selecting a guess.
- Bound episode pagination and validate provider slugs/episode identifiers before constructing API paths.
- Determine English dub availability from provider locale metadata.
- Parse the provider server URL only after it passes the configured upstream host allowlist. Extract only a bounded ID; never fetch the returned server URL.
- Construct the HLS URL only on the fixed `hls.krussdomi.com` CDN and only return it if that hostname passes `ANIVEXA_STREAM_ALLOWED_HOSTS`.
- Do not return provider cookies or authorization headers. The referer value is playback metadata, not a credential.
- No claim of live availability, successful browser playback, seeking or subtitle support is made by unit tests.

## Configuration

For KAA discovery, configure `ANIVEXA_ALLOWED_HOSTS` to include `graphql.anilist.co` and `kaa.lt`. If the KAA server response uses another legitimate server host for its ID-bearing URL, add that exact host only after verifying it from a provider response.

For KAA HLS results, configure `ANIVEXA_STREAM_ALLOWED_HOSTS` to include `hls.krussdomi.com` (or the narrower appropriate parent suffix `krussdomi.com`).

Anivexa remains disabled by default. Empty allowlists fail closed.

## Verification status

- Unit tests cover allowed and rejected KAA server URL forms, bounded IDs, fixed CDN URL construction and stream-host allowlist enforcement.
- CI must pass lint, TypeScript typecheck, backend/frontend/Python tests and production builds before this adapter is considered CI-verified.
- Live provider smoke tests and browser playback remain separate outstanding verification gates.

## Scope discipline

DNS-pinning work is deferred from the next provider milestones. Do not expand it or add adjacent network-hardening work unless a concrete requirement is approved. Existing security controls already in the Anivexa transport remain in place.
