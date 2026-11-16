# Samren Phase 3 — Implementation Progress

**Status:** IN PROGRESS — implementation not yet accepted
**Branch:** `phase-3-media-providers`
**Scope authorization:** Product-owner revision dated 2026-11-15
**Baseline:** `dcbc460639d5cf6ee7b2debcd3adee7e9f888bee`
**Latest checkpoint:** `6b32d293e4a57904d9f45f857ee245adef8de799` (upload sanitization fix; later CI validation pending)

## 1. Repository verification

- Active repository confirmed: `diabolicalG/samren`.
- Work is isolated on `phase-3-media-providers`; `main` was not changed.
- Reference repository: `diabolicalG/Anime-streaming`; inspected read-only.
- Phase 1 and Phase 2 documentation and baseline Prisma models were inspected.
- No Phase 3 implementation files were present in the Samren baseline tree. The backend contains the Phase 2 catalogue/admin metadata layer, but no local upload/storage/delivery/playback modules.
- Existing Prisma models already provide `MediaAsset`, `EpisodeMedia`, and `SubtitleTrack`; Phase 3 should extend their lifecycle without duplicating these models.

## 2. Scope revision committed

The product owner's option-B instruction is recorded in `PHASE_3_SCOPE.md` Section 13. It authorizes Kuhi and native Anivexa integration in addition to first-party local media. This amendment supersedes only the former provider exclusions; it does not authorize arbitrary URL proxying or modifications to Anime-streaming.

## 3. Source audit findings

### Kuhi

- Anime-streaming contains a TypeScript `KuhiProvider` client and provider contracts.
- The Kuhi service itself is represented in the reference repository tree as a Git submodule at `services/kuhi`, gitlink commit `d9a785ad030d6fc6a8ad709291be9612c864449e`.
- The reference repository tree does not contain a root `.gitmodules` file, so the submodule's canonical repository URL cannot be established from the inspected source.
- The client code alone does not provide the Kuhi service implementation. Integrating a URL without confirming its canonical source and endpoint ownership would be unsafe and would invent provenance.
- **BLOCKED:** obtain the Kuhi submodule URL/source or an authorized local clone before copying the service itself. Do not fabricate the source.

### Anivexa

- The reference contains a standalone Node.js API aggregator, twelve provider modules, AniList mapping/cache/episode-strategy modules, and six extractor modules plus FlixCloud support.
- Its runtime dependencies include `playwright-core` and `wreq-js`; it is not a small TypeScript provider client.
- The current provider modules perform remote-site scraping and some provider handlers include browser/request-impersonation behavior. Several responses contain remote URLs, headers, cookies, diagnostics, or raw upstream errors.
- The reference README documents routes for AniList mapping, episode discovery, and provider watch resolution. It also documents provider-specific playback constraints.
- The Anivexa source includes wildcard CORS and returns raw error details in some paths. These behaviors must not be copied into Samren.
- **NOT SAFE TO PORT BLINDLY:** each provider/extractor needs an endpoint, dependency, redirect, SSRF, response-size, timeout, credential/logging, and license audit before adoption. Preserve only required functionality and attribution.

## 4. Initial completion matrix

| Area | Initial status | Evidence / next work |
|---|---|---|
| Local storage adapter | MISSING | No storage module or configured storage root found |
| Upload route | MISSING | Admin currently registers metadata, not file bytes |
| Signature verification/checksum | MISSING | Existing schema has checksum/state fields only |
| Media delivery / byte ranges | MISSING | No first-party media route found |
| Playback metadata endpoint | MISSING | No episode playback endpoint found |
| Frontend watch player | MISSING | Existing frontend watch route is not part of the active Phase 2 app |
| Artwork delivery | MISSING | Existing catalogue returns metadata, no generated media URL |
| Kuhi client adaptation | BLOCKED / PARTIAL SOURCE | Reference client exists; source service submodule URL unavailable |
| Anivexa provider/extractor port | NOT STARTED | Large source/dependency/security audit required |
| Automated Phase 3 tests | MISSING | Add alongside each implementation unit |
| Final security audit | NOT STARTED | Required before Phase 3 completion |

## 5. Implementation guardrails

- Local assets and remote provider streams remain separate paths.
- Only local uploads become `MediaAsset` records.
- Do not persist remote stream URLs as local storage keys.
- Do not proxy arbitrary client-supplied URLs.
- Do not expose provider headers, cookies, secrets, raw errors, stack traces, or upstream diagnostics.
- Do not import browser automation or request-impersonation packages without a provider-specific justification and CI test plan.
- Preserve existing ADMIN and trusted-Origin middleware.
- Keep all changes in Samren and do not modify Anime-streaming.

## 6. Verification status

This checkpoint is documentation and source-audit work only. No application code, schema migration, or runtime behavior has been changed. No tests are claimed as run by this checkpoint.

## 7. Next implementation checkpoints

1. Resolve the Kuhi submodule source URL and audit its license/runtime.
2. Define Samren-native provider contracts and security boundary tests.
3. Implement local filesystem storage and upload validation.
4. Implement publication-aware media delivery and byte ranges.
5. Implement playback metadata and frontend player.
6. Port the approved Anivexa provider/extractor subset with per-provider tests.
7. Run full CI, security audit, and Phase 2 regression suite.
8. Freeze Phase 3 only after all acceptance gates pass.

## 8. Implementation checkpoint — local storage primitives

Implemented on `phase-3-media-providers`:

- Added `MEDIA_STORAGE_ROOT` configuration, defaulting to the private `.data/media` directory.
- Added generated opaque storage keys with strict format validation.
- Added canonical-root and canonical-parent containment checks to reject path escapes and symlink escapes.
- Added atomic temporary-file writes, restrictive file/directory permissions, SHA-256 calculation, and cleanup on write failure.
- Added local delete and file-stat helpers.
- Added unit tests for storage-key validation, traversal rejection, file contents, checksum calculation, and empty/oversized buffer rejection.
- Documented the storage-root setting in `apps/backend/.env.example`.

**Limitations of this checkpoint:**

- This is the storage primitive only; no HTTP upload endpoint, streaming multipart parser, signature sniffing, Prisma asset lifecycle transaction, media delivery route, or player integration is claimed complete.
- The current storage write helper accepts a bounded Buffer (50 MiB maximum); the approved upload path still needs a streaming implementation to avoid buffering large media in memory.
- The tests have been authored but have not been executed in a local runtime in this session. No passing test result is claimed.
- The existing admin metadata-only asset endpoints remain unchanged.

## 9. Next checkpoint

Implement streaming writes with byte limits and file-signature validation, then add the authenticated admin upload route and a database-backed asset lifecycle with rollback/cleanup. Follow with safe media delivery and byte-range handling.


## 10. Implementation checkpoint — upload, signatures, delivery

Additional implementation now present on this branch:

- Added streaming storage using a Node readable pipeline, incremental SHA-256, first-64-byte signature capture, byte-limit enforcement (up to a 2 GiB configured ceiling), temporary-file cleanup, and atomic rename.
- Added file-signature detection for JPEG, PNG, WebP, AVIF, MP4, WebM, WebVTT, SRT, and ASS.
- Added an ADMIN-protected, trusted-Origin upload endpoint at `POST /api/v1/admin/catalog/assets/upload`. It accepts raw request bodies with `x-media-kind` and `x-original-filename` headers; it does not accept multipart form data.
- Upload limits are 15 MiB for images, 2 MiB for subtitles, and 2 GiB for video.
- The upload endpoint stores validated files, computes checksums, and creates READY MediaAsset records; failed database writes trigger file cleanup.
- Added publication-aware public GET/HEAD delivery at `/api/v1/media/:id`, including single byte-range responses and 416 handling for invalid ranges.
- Public media delivery only resolves READY assets associated with published anime/episodes.
- Public catalogue responses now include first-party poster/banner delivery URLs.
- Added `.data/` to `.gitignore`.

**Current limitations:**

- The upload endpoint accepts raw binary request bodies, not multipart/form-data.
- The upload route currently creates the asset record but does not attach it to an anime or episode; existing admin association endpoints must be used separately.
- No frontend upload UI, player/watch route, subtitle selection UI, or playback progress integration has been completed.
- No runtime tests have yet been confirmed green for the latest code. Earlier CI runs failed at lint because of a missing closing brace in the new publication filter and an oxlint control-regex warning; both were corrected in later commits. A newer CI run is pending.
- This checkpoint does not complete the provider work. Kuhi remains blocked on locating the submodule origin; Anivexa porting has not started.

## 11. Current CI observations

- CI on the earlier upload-only checkpoint `a9fa1b2` completed successfully.
- Subsequent delivery changes exposed lint errors in an intermediate checkpoint. These were fixed in later commits.
- CI is being re-run against the latest branch head. Treat the result as pending until GitHub Actions reports completion.


## 12. Updated implementation status — 2026-11-16

The earlier Sections 4, 6, 7, 8, and 9 describe the baseline and first checkpoint only. They are historical notes, not the current implementation status. The following supersedes their "missing" entries where noted.

### Implemented on this branch

- Private filesystem storage rooted at `MEDIA_STORAGE_ROOT`, default `.data/media`, with `.data/` ignored by Git.
- Opaque generated storage keys, path containment checks, atomic temporary writes, restrictive file permissions, streaming write support, SHA-256 checksums, byte limits, and partial-file cleanup.
- Signature detection for JPEG, PNG, WebP, AVIF, MP4, WebM, WebVTT, SRT, and ASS.
- Admin-protected raw-binary upload endpoint at `POST /api/v1/admin/catalog/assets/upload`, using `x-media-kind` and `x-original-filename` headers, trusted-Origin validation, per-kind limits, signature/MIME comparison, and database-write cleanup.
- Publication-aware first-party media delivery at `GET/HEAD /api/v1/media/:id`, with single byte-range handling and 416 responses for invalid ranges.
- Public catalogue artwork URLs for uploaded poster/banner assets.
- API client upload support and admin artwork preview integration.
- A first-party episode playback metadata route at `GET /api/v1/catalog/anime/:slug/episodes/:episodeNumber/playback`, with READY local video sources and VTT subtitle tracks.
- Shared playback response types and API-client method.
- A first-party watch-page/player UI in the Next.js web application.

### Remaining local-media work

- The upload route accepts raw binary request bodies, not multipart form data.
- Uploading creates a READY asset but does not automatically attach it to an anime/episode; existing admin association endpoints remain a separate operation.
- The watch-page UI still uses the existing streaming hook for provider playback; end-to-end use of the new first-party playback metadata endpoint and local source fallback needs integration and tests.
- Verify all upload and delivery edge cases through automated tests and current CI.
- Complete frontend subtitle track selection and any required playback progress integration.

### Provider integration status

- **Kuhi service source remains BLOCKED.** The reference tree identifies `services/kuhi` as gitlink commit `d9a785ad030d6fc6a8ad709291be9612c864449e`, but the reference checkout has no `.gitmodules` file and the canonical submodule URL is not exposed. The source TypeScript client is inspectable, but the actual Kuhi service cannot be faithfully copied until its origin/source is available.
- **Anivexa port remains NOT STARTED.** Its reference tree contains twelve provider modules and six extractors plus shared mapping/cache utilities. Its runtime dependencies include browser automation and request-impersonation packages. Porting requires a deliberate dependency/security review; no Anivexa provider is claimed integrated in Samren yet.
- Anime-streaming remains read-only and unchanged.

### CI evidence

- Workflow run `43832443914` passed at checkpoint `f502cd555d`.
- Later playback/upload commits exposed lint/typecheck failures in intermediate commits. The failures were corrected in subsequent commits (including removal of an unused duplicate signature matcher and repair of escaped newline insertion).
- Workflows for the corrected playback commits were still running at the time of this update. Do not treat them as green until their final GitHub Actions conclusions are available.
- No local test execution is claimed in this environment.

### Current status

**Phase 3 remains IN PROGRESS and is not frozen.** The local upload/storage/delivery foundation and initial playback UI are present. Provider integration, complete first-party watch wiring, remaining UI behavior, full test verification, and final security audit remain open.


## 13. Kuhi submodule origin resolved

The previously unknown Kuhi submodule origin has now been identified by matching the exact gitlink commit SHA `d9a785ad030d6fc6a8ad709291be9612c864449e` against public Git commit objects.

- Upstream repository: `aryaniiil/anime-api`
- Exact source commit: `d9a785ad030d6fc6a8ad709291be9612c864449e`
- License at that commit: MIT (`LICENSE` must be retained with copied portions)
- Runtime dependencies declared upstream: FastAPI, Uvicorn, and HTTPX.
- The source tree includes the provider race layer, provider adapters, AniList extraction, parsing, and endpoint router.
- Samren already has a FastAPI application under `apps/api/src/main.py` and its existing unified media API package, with FastAPI and HTTPX dependencies available. The preferred integration path is to extend this existing application rather than add a second service.

The upstream service also exposes generic HLS manifest and segment proxy routes that accept arbitrary URL parameters. Those routes are **not approved for direct copying**. Any proxy capability retained in Samren must enforce fixed trusted provider hosts, redirect validation, bounded response sizes, timeouts, and safe referer handling. The copied endpoint router and provider implementations still require review before being mounted.

**Status update:** Kuhi source is no longer blocked by an unknown submodule URL. Integration has not yet been completed or tested.
