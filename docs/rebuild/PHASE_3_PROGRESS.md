# Samren Phase 3 — Implementation Progress

**Status:** IN PROGRESS — not accepted or frozen  
**Branch:** `phase-3-media-providers`  
**Baseline:** `dcbc460639d5cf6ee7b2debcd3adee7e9f888bee`  
**Latest code checkpoint:** `9eb6b03d019b658a22c3b17901b35ae2b902eb5c`  
**Pull request:** https://github.com/diabolicalG/samren/pull/5 (open; not merged)

## 1. Repository boundaries

- Active implementation repository: `diabolicalG/samren`.
- Reference repository: `diabolicalG/Anime-streaming`, inspected read-only.
- All Phase 3 commits are on this Samren feature branch. `main` has not been changed.
- Phase 1 and Phase 2 are treated as frozen; changes so far extend media behavior without changing their catalogue contracts.
- No changes have been made to Anime-streaming.

## 2. Approved scope revision

The product owner selected option B on 2026-11-15. The approved Phase 3 scope therefore includes:

- First-party local media storage, upload, delivery, artwork and episode playback.
- Kuhi provider integration.
- Native Anivexa provider/extractor integration in Samren rather than requiring a separately managed Anivexa service.

This revision does not authorize unrestricted URL proxying, exposing provider secrets, or changing the reference repository.

## 3. Source audit and provider blockers

### Kuhi

- Anime-streaming contains a TypeScript `KuhiProvider` client and provider contracts under `apps/backend/src/services/streaming`.
- The Kuhi service itself is a Git submodule at `services/kuhi`, gitlink commit `d9a785ad030d6fc6a8ad709291be9612c864449e`.
- The reference repository has no root `.gitmodules` file, and GitHub's submodule entry does not expose a canonical source URL.
- The missing submodule URL was bypassed without guessing: the reference repository also contains a separately licensed Kuhi API v3 implementation under `apps/kuhi-api`.
- Adapted the MIT-licensed provider modules into Samren's existing Python API: AniBD, AniKoto, AnimeGG, AnimeOnsen, AniNeko, AniWaves, AniZone, KAA, MKissa and ReAnime, with shared matching/cache/media/race helpers.
- Added native `/v1/kuhi/search`, `/providers`, `/episodes/{anilist_id}` and `/extract/{anilist_id}` routes. The extract route returns only allowlisted direct HTTPS streams and subtitle URLs; provider cookies/headers and raw URLs in episode metadata are omitted.
- Added an outbound HTTP transport that enforces HTTPS, explicit hostname allowlists, redirect revalidation and a 10 MiB response cap. Empty allowlists fail closed. `KUHI_PROVIDER_ALLOWED_HOSTS` and `KUHI_STREAM_ALLOWED_HOSTS` must be configured deliberately.
- Preserved the upstream MIT license and attribution in `apps/api/THIRD_PARTY_NOTICES.md`.
- The original Kuhi TypeScript client/submodule was not copied; the Python Kuhi API implementation is now the selected native integration path.

### Anivexa

- The reference contains a Node.js API aggregator, twelve provider modules, AniList mapping/cache/episode strategy modules, six extractor modules, and FlixCloud support.
- Its runtime dependencies include `playwright-core` and `wreq-js`; some providers use browser/request impersonation.
- The source also contains unsafe or unsuitable patterns that must not be copied unchanged:
  - `animedunya.js` constructs a shell command with a URL and executes it through `execSync`.
  - `mkissa.js` contains a hard-coded TMDB bearer token.
  - Some handlers expose raw upstream error details, cookies, request headers or diagnostic data.
  - The aggregator uses wildcard CORS.
- No Anivexa-specific LICENSE/NOTICE file was found in `apps/anivexa-api`. Its README identifies the upstream Anivexa API project separately. Reuse must be limited to material the user is authorized to reuse; otherwise implement a clean-room adapter from documented behavior.
- The product owner explicitly approved adapting/copying Anivexa into Samren, with the hard boundary that `Anime-streaming` remains read-only. The integration is being ported natively into Samren rather than running the standalone Anivexa service.
- Three native TypeScript provider adapters are implemented in Samren: AnimeGG episode discovery/watch extraction, AniZone paginated episode discovery plus watch extraction, and AniKoto episode discovery plus sub/dub watch extraction. AniZone resolves the selected series/episode using the existing AniList matcher and episode catalogue, parses the static Vidstack `vidstackPlayer(JSON.parse(...))` payload without executing scripts, and returns only allowlisted HTTPS HLS/MP4 sources and allowlisted subtitle URLs. AniZone currently exposes subbed sources only; dub requests fail closed. AniKoto resolves the selected server, accepts direct allowlisted HLS/MP4 URLs, supports the Vidplay `getSources` JSON endpoint, and supports MegaPlay plaintext sources or AES-CBC payloads when the key/IV are recoverable from static script literals. Embed pages and scripts must pass the configured upstream HTTPS allowlist; resulting media URLs must pass the separate stream-host allowlist. The adapters never execute provider JavaScript. MegaPlay sources requiring a runtime-derived HMAC signing key are deliberately skipped; those servers remain unsupported until a safe, non-executing signing implementation is available. This is an adapted native implementation, not a wholesale copy of the upstream runtime.
- The upstream source contains unsafe or unsuitable patterns that remain excluded: shell-command execution, embedded bearer credentials, unsafe dynamic-code evaluation, raw upstream diagnostics/cookies, and wildcard CORS. Any additional provider/extractor must use Samren's HTTPS allowlist, redirect revalidation, response limits and stream-host policy. Do not copy secrets or execute provider-supplied code.

### Anivexa provider extraction checkpoint

- Added AniZone watch extraction through `GET /api/v1/anivexa/extract/:anilistId/:episode?provider=anizone&audio=sub`.
- Added safe Vidstack player-payload parsing tests, including missing/malformed source rejection.
- CI run [43910499307](https://github.com/diabolicalG/samren/actions/runs/43910499307) passed lint, typecheck, backend tests, frontend smoke/accessibility tests, Python API tests and production builds on `9eb6b03d019b658a22c3b17901b35ae2b902eb5c`.
- No live AniZone stream or browser playback has been verified. AniZone's provider response currently exposes sub only; dub extraction is explicitly unsupported. Subtitle formats are passed through as metadata after URL allowlisting; actual browser subtitle compatibility still needs end-to-end testing.

## 4. Implemented first-party media work

### Storage and upload

- Added `MEDIA_STORAGE_ROOT`, defaulting to `.data/media`, and documented it in `apps/backend/.env.example`.
- Added `.data/` to `.gitignore`.
- Added generated opaque storage keys with strict format validation.
- Added root/parent canonicalization and path containment checks.
- Added atomic temporary-file writes, restrictive file permissions, SHA-256 checksums and cleanup on failure.
- Added conservative API-startup cleanup for abandoned generated temp files older than 24 hours. It scans only canonical shard directories and generated temp-file names, preserves symlinks and unrelated files, and is best-effort so cleanup failures do not prevent API startup.
- Added conservative startup cleanup for abandoned generated temp files older than 24 hours. It scans only canonical two-character shard directories and generated temp-file names, preserves symlinks/unrelated files, and is best-effort so cleanup failure does not block API startup.
- Added bounded streaming writes with incremental hashing and size enforcement.
- Added file-signature detection for JPEG, PNG, WebP, AVIF, MP4, WebM, WebVTT, SRT and ASS.
- Added an ADMIN- and trusted-Origin-protected upload endpoint that accepts both bounded raw-binary requests (compatibility) and multipart/form-data requests with exactly one `file` part:
  - `POST /api/v1/admin/catalog/assets/upload`
  - Headers: `x-media-kind`; multipart uses the uploaded file name and part MIME type, while raw-binary compatibility uses `x-original-filename` and `Content-Type`.
  - Multipart is parsed with Formidable, limited to one accepted file part and no extra fields; staging uses a private temporary directory that is removed after processing.
  - Limits: 15 MiB for images, 2 MiB for subtitles, 2 GiB for video.
- The upload endpoint creates a `PENDING` `MediaAsset` record before writing, transitions it to `READY` only after storage and signature validation, and transitions it to `FAILED` on processing errors. Database writes are guarded by the expected `PENDING` state to prevent stale-upload reconciliation races.
- API startup marks stale managed `PENDING` assets older than 24 hours as `FAILED` and removes their managed file when present. Reconciliation is conditional, paginated in batches of 500, skips legacy metadata-only storage keys, and does not block API startup on failure.
- API startup also scans only old regular files matching the generated managed-storage layout. Files without a database reference or attached to a `FAILED` record are removed; files referenced by `READY` or `PENDING` records are preserved. Database checks are batched and deletion failures are retried on a later startup.
- Added an admin upload control and API client method.
- Legacy metadata-only assets remain supported. Deletion only unlinks files with Samren-generated managed storage keys.

**Limitations:** the upload operation does not automatically attach the asset to an anime or episode; the existing admin association endpoints remain responsible for that. Reconciliation is startup-driven and best-effort; orphan-file cleanup after a failed filesystem deletion and multi-instance operational scheduling still need additional coverage.

### Public media delivery and playback

- Added publication-aware `GET` and `HEAD` delivery at `/api/v1/media/:id`.
- Added single HTTP byte-range support and 416 responses for invalid ranges.
- Delivery only exposes READY assets attached to published anime/episodes.
- Public catalogue responses now include first-party poster URLs; the frontend renders poster and detail artwork when present.
- Added published episode playback metadata at `/api/v1/catalog/anime/:slug/episodes/:episodeNumber/playback`.
- Added a first-party watch page at `/watch/:slug/:episodeNumber` with native video controls and WebVTT subtitle tracks.

**Frontend status:** previous/next episode navigation and browser-local playback progress are implemented. A first-party quality selector was added in checkpoint `18138781cb77303c87cab9c1c022ebdf7be34549`, and a frontend regression test now verifies switching between available sources. CI run `43890218066` passed on `3b45fbe0869d72e492483b1d5db66ab8042526b8`. An end-to-end browser playback test remains outstanding. SRT and ASS can be stored and delivered as files but are not advertised as native HTML subtitle tracks; WebVTT is the player-supported format.

### Latest hardening and test checkpoint

- Added `cleanupStaleMediaTempFiles` with a conservative 24-hour default, strict generated-name/shard matching, symlink avoidance and deterministic unit coverage for stale, fresh, unrelated and symlink entries. The API invokes it at startup; cleanup failure is logged without blocking startup. CI run `43893703065` on code checkpoint `1ecde28dbbf3a9827cfec7bc69147a51039b0450` was in progress when this progress note was prepared.

- Enforced `0700` permissions on the configured storage root and generated shard directories, including tightening permissions on an existing root; generated media files remain `0600`.
- Added a storage regression test that deliberately starts with a permissive `0755` root and verifies the root, shard and file modes are tightened.
- Added focused public media-delivery tests for published/READY gating, safe response headers, HEAD behavior, byte-range clamping, malformed/unsatisfiable ranges, and missing files.
- Added an authenticated upload integration test covering successful signature-verified PNG upload, READY asset metadata, signature mismatch rejection, and managed-file cleanup. The first CI attempt (`43891871691`) ran against the preceding test commit with an incorrect route prefix and failed with 404; the route prefix was corrected in `4dd5f77a8f9488cc00606f8b7b0828a9c80e1626`. The corrected route-prefix commit `4dd5f77a8f9488cc00606f8b7b0828a9c80e1626` passed CI run `43892195844`, including the authenticated upload test, signature-mismatch rejection, backend/frontend/Python tests and production builds. [Workflow run](https://github.com/diabolicalG/samren/actions/runs/43892195844).
- These changes are committed through `a54e19dffccc595114654827afae0798837578bb`. CI run `43889715112` passed the storage/delivery regression suite and all workflow steps. The subsequent quality-selector test run `43890218066` also passed on `3b45fbe0869d72e492483b1d5db66ab8042526b8`: Prisma validation/generation/migrations, seed idempotence, lint, typecheck, backend API tests, frontend smoke/accessibility tests, Python API tests and frontend/backend production builds. [Latest workflow run](https://github.com/diabolicalG/samren/actions/runs/43890218066).

## 5. Verification

- CI run `43889715112` passed on `a54e19dffccc595114654827afae0798837578bb`, including the new storage permission and public media-delivery tests.
- CI run `43890218066` passed on `3b45fbe0869d72e492483b1d5db66ab8042526b8`, including the playback quality-selection regression test.
- Both runs passed Prisma validation/generation/migrations, deterministic seed/idempotence, lint, typecheck, backend API tests, frontend smoke/accessibility tests, Python API tests and frontend/backend production builds.
- The earlier Kuhi security and provider test checkpoints also passed CI, including private-DNS rejection.
- Multipart upload CI run `43894938150` passed Prisma validation/generation/migrations, seed idempotence, lint, typecheck, backend API tests, frontend smoke/accessibility tests, Python API tests, and frontend/backend production builds. The first attempt `43894219693` stopped at typecheck because Formidable lacked declarations; a local declaration was added and the corrected run passed. [Multipart workflow run](https://github.com/diabolicalG/samren/actions/runs/43894938150).
- Lifecycle CI run `43896585549` passed all workflow steps. It verifies the PENDING-to-READY upload path, signature-mismatch transition to FAILED, stale pending reconciliation, pagination beyond legacy metadata records, typecheck, all API tests, Python tests and production builds. [Lifecycle workflow run](https://github.com/diabolicalG/samren/actions/runs/43896585549).
- Orphan-file reconciliation CI run `43897217999` passed all workflow steps, including generated-path filtering, stale-file selection, database-reference preservation, typecheck, backend/frontend/Python tests and production builds. [Orphan reconciliation workflow run](https://github.com/diabolicalG/samren/actions/runs/43897217999).
- Anivexa initial provider-port CI run `43899918673` passed all workflow steps, including Prisma validation/generation/migrations, seed idempotence, lint, typecheck, backend/frontend tests, Python API tests and production builds. [Initial AnimeGG episode-discovery CI](https://github.com/diabolicalG/samren/actions/runs/43899918673).
- AnimeGG watch extraction CI run `43900588919` passed all workflow steps. It verifies the added extraction route, stream-host allowlist policy, lint, typecheck, backend/frontend tests, Python tests and production builds. [AnimeGG extraction CI](https://github.com/diabolicalG/samren/actions/runs/43900588919).
- AniZone provider CI run `43901242289` passed all workflow steps. [AniZone initial provider CI](https://github.com/diabolicalG/samren/actions/runs/43901242289).
- AniZone Livewire pagination and AniKoto episode-discovery changes are covered by CI run `43902567326` (pagination) and `43902891845` (AniKoto and final fixture correction); both passed all workflow steps, including typecheck, backend/frontend/Python tests and production builds. [AniKoto provider CI](https://github.com/diabolicalG/samren/actions/runs/43902891845).
- AniKoto direct extraction CI run `43907502476` passed all workflow steps on `fa7153149ff64d67cf6c948f68f98d2775ad14e7`. Follow-up safe embed extraction CI run `43908912162` passed all workflow steps on `26fa577044bef606f00020d6c9727ba35311b683`, including lint, typecheck, backend/frontend tests, Python API tests and production builds. Tests cover static MegaPlay route parsing, AES-CBC payload decryption, malformed encrypted payload rejection, direct URL/fragment parsing and embed-host rejection. MegaPlay lexer hardening CI run `43914335184` passed all workflow steps on `9cbbdeda13178e73a7e2081b3e20f7738720e2ca`; regression coverage now checks comment/regex false positives and escaped route literals without executing JavaScript. Live provider playback and runtime-HMAC server compatibility remain unverified.
- GitHub Actions is the executable validation environment for this session; no claim is made that local tests or live provider playback were run.

## 6. Current completion matrix

| Area | Status | Remaining work |
|---|---|---|
| Local storage primitives | PARTIAL — HARDENED | Startup cleanup covers stale temp files, stale PENDING assets and unreferenced/FAILED managed files; multi-instance and deletion-failure operational tests remain |
| Admin upload | PARTIAL — MULTIPART + RAW + LIFECYCLE | Multipart/raw upload and PENDING/READY/FAILED lifecycle tests pass CI run `43896585549`; upload/association workflow remains separate; startup reconciliation is best-effort and orphan cleanup remains outstanding |
| Signature validation/checksum | PARTIAL | Unit tests pass; broaden malformed/large-input cases |
| Public media delivery | PARTIAL — TESTED | GET/HEAD/range tests pass; add more publication and failure-path coverage |
| Artwork URLs/rendering | PARTIAL | Verify with real uploaded assets and responsive layouts |
| Episode playback metadata | PARTIAL | Add database-backed playback integration coverage |
| Frontend player | PARTIAL — TESTED | Quality selector test passes; real browser playback and subtitle behavior remain to verify |
| Kuhi providers/API | IMPLEMENTED — CI VERIFIED | Configure reviewed provider/CDN allowlists; live provider smoke tests remain environment-dependent |
| Anivexa providers/extractors | PARTIAL — FOUR ROUTED PROVIDERS | AnimeGG, AniZone, AniKoto and KickAssAnime episode discovery/watch extraction are implemented. KAA uses fixed HTTPS API/CDN origins, confidence-gated AniList matching, bounded episode pagination and allowlisted stream URL construction. AnimeOnsen is not routed; its dynamic API/search origin checks and stream/subtitle URL filtering are hardened, but it remains disabled/unavailable until separately integrated and live-tested. Runtime-HMAC MegaPlay, additional safe provider ports, mapping/cache parity and live playback remain outstanding |
| Provider security tests | PARTIAL | Kuhi URL/DNS/allowlist tests exist; Anivexa HTTPS host allowlist, redirect revalidation, timeout, 5 MiB response cap, stream URL allowlist, disabled-route tests, MegaPlay static-lexer tests and AnimeOnsen dynamic-origin/stream/subtitle allowlist tests pass. AnimeOnsen bearer headers are no longer returned in stream metadata. pinned DNS transport regression tests now cover lookup pinning and private/mixed DNS answers; live provider tests remain |
| Final Phase 3 audit | NOT STARTED | Complete only after all approved acceptance gates pass |

## 7. Security requirements retained

- Local files and remote provider streams remain separate asset paths.
- Never store a remote provider URL as a local storage key.
- Never proxy arbitrary user-supplied URLs.
- Never expose cookies, credentials, private headers, stack traces or raw provider diagnostics.
- Any provider-returned URL must be validated against an explicit provider policy before use.
- No browser-automation or request-impersonation dependency is to be introduced without a provider-specific justification, license review and CI plan.
- Preserve admin authentication and trusted-Origin checks.

## 8. Next checkpoints

1. Continue the user-authorized Anivexa port into Samren only. Audit and port only providers whose upstream behavior can be adapted with fixed HTTPS origins, explicit host allowlists, bounded requests and no embedded credentials or shell execution. AnimeOnsen's dynamic API/search origins and session bearer tokens require origin validation before use; AnimeDunya's shell-command execution and Mkissa's embedded bearer token are excluded as-is. Keep MegaPlay runtime-HMAC servers fail-closed until a safe, testable non-executing signer exists. Do not modify Anime-streaming.
2. Broaden storage failure/race tests under multi-instance deployment conditions and verify orphan deletion retry behavior when filesystem permissions or disk errors prevent cleanup.
3. Add end-to-end browser playback verification, including real media seeking, source switching, subtitle selection and episode navigation.
4. Complete provider failure/SSRF/security tests, Phase 2 regression checks and full CI after the Anivexa port.
5. Complete the final Phase 3 audit. Freeze Phase 3 only when every approved acceptance criterion is verified.


## 9. AnimeOnsen security hardening checkpoint (2026-11-16)

- The dormant AnimeOnsen adapter was audited before any route integration. Its bootstrap page supplies API/search origins dynamically; these origins are now rejected unless their exact HTTPS hostnames are explicitly configured through `ANIVEXA_ANIMEONSEN_API_HOSTS` and `ANIVEXA_ANIMEONSEN_SEARCH_HOSTS`. The generic `ANIVEXA_ALLOWED_HOSTS` policy still applies to outbound requests.
- The adapter revalidates the configured origins immediately before sending bearer-authenticated API/search requests.
- Returned DASH stream URLs and subtitle URLs must pass the separate `ANIVEXA_STREAM_ALLOWED_HOSTS` allowlist. Subtitle URLs from other hosts are filtered out.
- The provider response no longer includes the AnimeOnsen bearer token in stream or subtitle `headers`; no provider authorization header is sent to the browser.
- Added tests for hostile origin suffixes, HTTP, userinfo, non-default ports, origin paths, stream allowlist boundaries and subtitle filtering/credential isolation.
- CI run `43916398893` passed all workflow steps on `2d39c2e701041bc5bb18654c413303a8cab986c9`, including lint, typecheck, backend/frontend/Python tests and production builds.
- This is security hardening only. AnimeOnsen is not added to the public provider route and is not claimed as a working playback provider. Its stream may require server-side authorization; browser playback must not be enabled until the required transport is implemented without exposing credentials.


## 10. DNS-rebinding hardening checkpoint (2026-11-16)

- Replaced the Anivexa core client's check-then-fetch sequence with a pinned HTTPS transport. Each request resolves its hostname once, rejects the entire answer set if any address is non-public, and supplies those validated addresses to Node's HTTPS lookup callback. The TLS request still uses the original hostname, preserving hostname-based certificate validation and SNI.
- Every redirect is handled manually and independently revalidated, re-resolved and pinned. The transport retains HTTPS-only and host-suffix allowlisting, a 10-second abort timeout, a four-redirect limit and a 5 MiB response cap.
- The separate TypeScript Anivexa HTTP client now delegates to this same pinned transport, so provider requests do not bypass DNS pinning.
- Expanded address filtering to reject private, loopback, link-local, carrier-grade NAT, multicast/reserved IPv4, non-global IPv6, IPv4-mapped private IPv6 and IPv6 documentation/special-use ranges. Mixed public/private DNS answer sets fail closed.
- Added regression tests for pinned IPv4/IPv6 lookup callbacks, empty pin sets, private/loopback/link-local/documentation addresses and mixed DNS answer sets.
- Request bodies are buffered before transmission; unsupported streaming bodies fail closed rather than silently falling back to native fetch.
- CI run [43917982848](https://github.com/diabolicalG/samren/actions/runs/43917982848) passed on `3d3dd37baca7aa1340c739c4f5eccfcbd18798d3`, including lint, typecheck, backend/frontend/Python tests and production builds. This does not establish live provider availability or browser playback.


## 11. Remaining-provider audit and KickAssAnime checkpoint (2026-11-16)

- Audited the remaining Anivexa providers against the approved constraints: fixed HTTPS origins, configured hostname allowlists, bounded requests, no embedded credentials, no shell execution, no provider JavaScript execution, and no unreviewed browser/request-impersonation dependency. The decision record is in `docs/rebuild/PHASE_3_PROVIDER_AUDIT.md`.
- Selected KickAssAnime (KAA) as the next independent adapter. AnimeNoSub is deferred pending third-party embed/extractor host review; Ani.pm and Senshi are deferred because their upstream implementations depend on `wreq-js` request impersonation and dynamic embed/session services; AnimeDunya and MKissa remain excluded as-is because of shell execution and an embedded bearer credential respectively.
- Added native KAA episode discovery and stream extraction in `apps/backend/src/anivexa/kaa.ts`, and exposed `kaa` through the existing Anivexa provider discovery and extraction routes. Existing AnimeGG, AniZone, AniKoto and AnimeOnsen implementations were not rewritten.
- KAA uses the existing safe Anivexa HTTP transport for AniList and `kaa.lt`; it performs confidence-gated title/year/format matching, bounds episode pagination, validates episode/server identifiers, checks the configured upstream host allowlist before parsing a server ID, constructs HLS URLs only on the fixed `hls.krussdomi.com` CDN, and returns streams only when the CDN passes `ANIVEXA_STREAM_ALLOWED_HOSTS`.
- Documented the KAA host requirements in `apps/backend/.env.example`. Discovery requires `graphql.anilist.co` and `kaa.lt` in `ANIVEXA_ALLOWED_HOSTS`; stream extraction requires `hls.krussdomi.com` (or a verified narrower parent suffix) in `ANIVEXA_STREAM_ALLOWED_HOSTS`. Anivexa remains disabled by default and empty allowlists fail closed.
- Added unit coverage for HTTPS/host/credential/port validation, server-ID character bounds, fixed CDN URL construction and stream allowlist rejection.
- CI verification is pending for the latest KAA implementation checkpoint. Live provider availability, browser playback, seeking and subtitle behavior have not been verified.
- DNS-pinning expansion is deferred from the next provider milestones. Existing code is left unchanged; no additional DNS-related work is included in this checkpoint.
