# Samren Phase 3 — Implementation Progress

**Status:** IN PROGRESS — not accepted or frozen  
**Branch:** `phase-3-media-providers`  
**Baseline:** `dcbc460639d5cf6ee7b2debcd3adee7e9f888bee`  
**Latest code checkpoint:** `828df8ad1c4382084d84556c95f9dc936efd7de8`  
**Pull request:** https://github.com/diabolicalG/samren/pull/5 (draft; not merged)

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
- **NOT STARTED:** no Anivexa provider/extractor source has been copied into Samren. Its tree has no project LICENSE/NOTICE, its README points to a separate upstream Anivexa API project, and source contains shell execution and embedded credentials. The user-approved copy must not proceed until reuse rights are confirmed; unsafe code must be rewritten or excluded.

## 4. Implemented first-party media work

### Storage and upload

- Added `MEDIA_STORAGE_ROOT`, defaulting to `.data/media`, and documented it in `apps/backend/.env.example`.
- Added `.data/` to `.gitignore`.
- Added generated opaque storage keys with strict format validation.
- Added root/parent canonicalization and path containment checks.
- Added atomic temporary-file writes, restrictive file permissions, SHA-256 checksums and cleanup on failure.
- Added bounded streaming writes with incremental hashing and size enforcement.
- Added file-signature detection for JPEG, PNG, WebP, AVIF, MP4, WebM, WebVTT, SRT and ASS.
- Added an ADMIN- and trusted-Origin-protected raw-binary upload endpoint:
  - `POST /api/v1/admin/catalog/assets/upload`
  - Headers: `x-media-kind`, `x-original-filename`, and the actual detected `Content-Type`.
  - Limits: 15 MiB for images, 2 MiB for subtitles, 2 GiB for video.
- The upload endpoint creates READY `MediaAsset` records and removes stored files when the database write fails.
- Added an admin upload control and API client method.
- Legacy metadata-only assets remain supported. Deletion only unlinks files with Samren-generated managed storage keys.

**Limitations:** upload requests are raw binary bodies, not multipart/form-data. The upload operation creates the asset but does not automatically attach it to an anime or episode; the existing admin association endpoints remain responsible for that.

### Public media delivery and playback

- Added publication-aware `GET` and `HEAD` delivery at `/api/v1/media/:id`.
- Added single HTTP byte-range support and 416 responses for invalid ranges.
- Delivery only exposes READY assets attached to published anime/episodes.
- Public catalogue responses now include first-party poster URLs; the frontend renders poster and detail artwork when present.
- Added published episode playback metadata at `/api/v1/catalog/anime/:slug/episodes/:episodeNumber/playback`.
- Added a first-party watch page at `/watch/:slug/:episodeNumber` with native video controls and WebVTT subtitle tracks.

**Remaining frontend work:** previous/next episode navigation, local playback progress, quality selection, and an end-to-end browser playback test are not yet complete. SRT and ASS can be stored and delivered as files but are not advertised as native HTML subtitle tracks; WebVTT is the player-supported format.

## 5. Verification

- CI run `43832779866` passed all workflow steps for checkpoint `843582214b5cd32d1c4d4d9a7d5d0a223e686a05`: Prisma validation/generation/migration, seed/idempotence, lint, typecheck, backend tests, frontend tests and production build.
- A later CI run `43832904848` failed one existing admin asset deletion test because newly added file cleanup rejected a legacy metadata-only storage key. The cleanup now checks `isManagedStorageKey` and only unlinks generated keys.
- CI run `43887063532` is running against `828df8ad1c4382084d84556c95f9dc936efd7de8`; its outcome must be checked before claiming the Python integration passes.
- No local runtime is available in this session; GitHub Actions is the executable validation environment.

## 6. Current completion matrix

| Area | Status | Remaining work |
|---|---|---|
| Local storage primitives | PARTIAL | Streaming path exists; add broader failure/race tests and operational cleanup |
| Admin raw-binary upload | PARTIAL | Multipart support not implemented; attach associations remains separate |
| Signature validation/checksum | PARTIAL | Unit tests exist; broaden malformed/large-input cases |
| Public media delivery | PARTIAL | Add integration tests for access rules, HEAD and byte ranges |
| Artwork URLs/rendering | PARTIAL | Verify on real uploaded assets and responsive layouts |
| Episode playback metadata | PARTIAL | Add playback integration tests and episode navigation/progress |
| Frontend player | PARTIAL | Add previous/next, quality selection and browser playback verification |
| Kuhi providers/API | IMPLEMENTED; CI VERIFICATION PENDING | Run Python tests; configure reviewed provider/CDN allowlists; live provider smoke tests remain environment-dependent |
| Anivexa providers/extractors | NOT STARTED | Resolve reuse rights, then port safe provider subset and required extractors |
| Provider security tests | NOT STARTED | URL validation, SSRF, timeouts, response limits, secrets and error redaction |
| Final Phase 3 audit | NOT STARTED | Complete only after all acceptance gates pass |

## 7. Security requirements retained

- Local files and remote provider streams remain separate asset paths.
- Never store a remote provider URL as a local storage key.
- Never proxy arbitrary user-supplied URLs.
- Never expose cookies, credentials, private headers, stack traces or raw provider diagnostics.
- Any provider-returned URL must be validated against an explicit provider policy before use.
- No browser-automation or request-impersonation dependency is to be introduced without a provider-specific justification, license review and CI plan.
- Preserve admin authentication and trusted-Origin checks.

## 8. Next checkpoints

1. Verify current CI after the legacy asset deletion compatibility fix.
2. Add tests for upload endpoint, publication-aware delivery, byte ranges and playback metadata.
3. Complete frontend previous/next navigation and local progress.
4. Resolve Kuhi submodule source and adapt the client/service.
5. Confirm Anivexa reuse rights and port safe provider/extractor functionality into Samren without shell execution or embedded credentials.
6. Run provider failure/security tests, Phase 2 regressions and full CI.
7. Complete the final Phase 3 audit. Freeze Phase 3 only when every approved acceptance criterion is verified.
