# Samren Phase 3 — Implementation Progress

**Status:** IN PROGRESS — not accepted or frozen  
**Branch:** `phase-3-media-providers`  
**Baseline:** `dcbc460639d5cf6ee7b2debcd3adee7e9f888bee`  
**Latest code checkpoint:** `4dd5f77a8f9488cc00606f8b7b0828a9c80e1626`  
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
- **NOT STARTED:** no Anivexa provider/extractor source has been copied into Samren. Its tree has no project LICENSE/NOTICE, and its README attributes the implementation to the separate upstream `walterwhite-69/Anivexa-API` repository. GitHub reports no declared licence for that upstream repository. The product owner approved the integration scope, but that does not establish third-party copyright permission. Obtain permission or a clear licence from the upstream rights holder before adapting source. Once rights are established, rewrite/exclude shell execution, embedded credentials, unsafe diagnostics and wildcard CORS; do not bring the standalone service into Samren.

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

**Frontend status:** previous/next episode navigation and browser-local playback progress are implemented. A first-party quality selector was added in checkpoint `18138781cb77303c87cab9c1c022ebdf7be34549`, and a frontend regression test now verifies switching between available sources. CI run `43890218066` passed on `3b45fbe0869d72e492483b1d5db66ab8042526b8`. An end-to-end browser playback test remains outstanding. SRT and ASS can be stored and delivered as files but are not advertised as native HTML subtitle tracks; WebVTT is the player-supported format.

### Latest hardening and test checkpoint

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
- GitHub Actions is the executable validation environment for this session; no claim is made that local tests or live provider playback were run.

## 6. Current completion matrix

| Area | Status | Remaining work |
|---|---|---|
| Local storage primitives | PARTIAL — HARDENED | Operational stale-file cleanup; broader failure/race and deployment tests |
| Admin upload | PARTIAL — INTEGRATION TEST ADDED | Current endpoint is bounded raw-binary, not multipart; upload/association workflow remains separate; corrected upload integration test passes CI run `43892195844`; complete lifecycle/failure reconciliation |
| Signature validation/checksum | PARTIAL | Unit tests pass; broaden malformed/large-input cases |
| Public media delivery | PARTIAL — TESTED | GET/HEAD/range tests pass; add more publication and failure-path coverage |
| Artwork URLs/rendering | PARTIAL | Verify with real uploaded assets and responsive layouts |
| Episode playback metadata | PARTIAL | Add database-backed playback integration coverage |
| Frontend player | PARTIAL — TESTED | Quality selector test passes; real browser playback and subtitle behavior remain to verify |
| Kuhi providers/API | IMPLEMENTED — CI VERIFIED | Configure reviewed provider/CDN allowlists; live provider smoke tests remain environment-dependent |
| Anivexa providers/extractors | BLOCKED / NOT STARTED | Obtain upstream reuse permission or a clear licence; then port a safe subset |
| Provider security tests | PARTIAL | Kuhi URL/DNS/allowlist tests exist; Anivexa-specific tests cannot start until reuse path is cleared |
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

1. Obtain written reuse permission or a clear licence from the Anivexa upstream rights holder; the upstream repository currently declares no licence. Do not copy its source until this is resolved.
2. Complete the approved native Anivexa provider/extractor integration after the rights gate, replacing unsafe shell execution, hard-coded credentials, unsafe diagnostics and wildcard CORS.
3. Reconcile the upload endpoint with the approved multipart requirement and document/test the PENDING/READY/FAILED lifecycle and database/filesystem failure behavior.
4. Add operational stale-temporary-file cleanup and broader storage failure/race tests.
5. Add end-to-end browser playback verification, including real media seeking, source switching, subtitle selection and episode navigation.
6. Complete provider failure/SSRF/security tests, Phase 2 regression checks and full CI after the Anivexa port.
7. Complete the final Phase 3 audit. Freeze Phase 3 only when every approved acceptance criterion is verified.
