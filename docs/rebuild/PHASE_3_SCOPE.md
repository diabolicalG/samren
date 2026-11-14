# Samren Phase 3 — First-Party Media Storage, Delivery and Playback

**Status:** PROPOSED — scope approved by product owner; implementation NOT authorized  
**Repository:** `diabolicalG/samren`  
**Branch:** `main`  
**Planning baseline:** `9726d72336daa5e635b0905ce44a90b6470a1639`  
**Previous phase:** Phase 2 — COMPLETE and FROZEN  
**Storage decision:** Local, application-managed filesystem storage  
**Scope decision:** Full proposed Phase 3 scope  
**Architecture reference:** `diabolicalG/Anime-streaming` is READ ONLY

> This document authorizes planning and review only. It does not authorize implementation, dependency changes, migrations, configuration changes, or application-code edits. Phase 3 implementation requires a separate, explicit approval after this document has been reviewed.

---

## 1. Objective

Implement a secure, first-party media lifecycle for Samren using the existing application-owned catalogue and media metadata.

Administrators must be able to upload and manage poster, banner, video and subtitle files. Samren must verify and store those files locally, expose only authorized application-owned media, and provide a working watch experience for published episodes that have playable first-party video assets.

The media system must remain independent of external anime APIs, scraping systems, streaming providers, embed hosts, remote stream URLs and arbitrary proxy targets.

If an episode has no ready, valid first-party video asset, the watch experience must show an intentional unavailable state. It must never attempt a third-party fallback.

## 2. Baseline and existing contracts

The Phase 2 implementation already provides:

- PostgreSQL/Prisma `MediaAsset` metadata: storage key, original filename, media kind, MIME type, byte size, optional SHA-256 checksum, processing state and optional media dimensions/duration.
- `EpisodeMedia` relations between episodes and video assets, including quality labels and a default flag.
- `SubtitleTrack` relations between episodes and subtitle assets, including language, label, format and a default flag.
- Anime poster/banner relations to `MediaAsset`.
- Admin catalogue asset metadata routes protected by the existing database-backed ADMIN session and trusted-Origin checks.
- Public catalogue queries restricted to published catalogue records.
- Shared TypeScript catalogue and admin media contracts.

Phase 2 explicitly does not implement file uploads, storage-object verification, public media delivery, artwork URL generation or a video player. Those are the responsibilities of this phase.

**Planning constraint:** inspect and reuse the actual Phase 2 schema, route conventions, validation schemas and auth middleware during implementation. Do not duplicate existing asset metadata or weaken existing authorization to make uploads easier.

## 3. Hard boundaries

- Modify only `diabolicalG/samren`.
- `diabolicalG/Anime-streaming` is read-only architecture reference; never commit changes there.
- Do not delete or refactor legacy Samren applications or shared packages as part of this phase unless a separately approved, directly necessary change is documented first.
- No external anime metadata APIs, anime APIs, scrapers, crawlers, provider adapters, provider identifiers, source resolvers, third-party embeds, remote stream URLs, stream proxies or provider fallbacks.
- No arbitrary URL fetcher, user-controlled redirect target, arbitrary filesystem path, or public static mount of the storage directory.
- Only application-owned files uploaded through authorized Samren workflows may become media assets.
- PostgreSQL remains the authoritative source for catalogue and asset metadata. The filesystem stores bytes, not catalogue identity.
- Do not put uploaded media, secrets, credentials or local runtime data in Git.
- No Docker requirement for local development. CI must exercise storage behavior using an isolated temporary directory.
- Do not claim production storage durability, backup/restore or deployment readiness without testing the actual deployment environment.
- Do not start Phase 4 or add user accounts, watchlists, server-synchronized history, or personal-library features.

## 4. Local storage architecture

### 4.1 Storage choice

Use a local filesystem storage adapter behind a small application-owned interface. The first implementation is local storage only; do not implement S3, cloud buckets, third-party storage services or an object-storage deployment in this phase.

The storage adapter should expose narrowly scoped operations such as storing a validated upload, opening/reading an object for delivery, checking object existence and size, deleting an object safely, and validating an application-generated storage key. API clients must never choose a filesystem path or storage root.

### 4.2 Configuration and location

- Configure the storage root using a validated `MEDIA_STORAGE_ROOT` environment setting.
- Require or resolve it to an absolute filesystem location at startup.
- Provide a documented local-development default under an ignored application data directory (for example, `.data/media`); production deployments should set an explicit persistent path outside the repository and outside any web-served directory.
- Add the chosen local data directory to the appropriate Git ignore rules before any local file can be accidentally committed.
- Fail safely on invalid, missing or unusable storage configuration. Do not silently fall back to a public directory or a temporary directory in production.
- Document that local filesystem storage is intended for a single application host or shared persistent volume. Multi-host replication, cloud object storage and CDN integration are outside this phase.

### 4.3 Storage-key and filesystem safety

- Generate opaque, non-user-controlled storage keys.
- Normalize and validate keys at the storage boundary.
- Prevent path traversal, absolute-path injection, separator tricks, symlink escapes and writes outside the configured root.
- Do not use the original filename as a path component.
- Create files with restrictive permissions where supported.
- Write to a temporary file in the target filesystem and atomically finalize the object only after validation succeeds.
- Avoid overwriting an existing object on key collision.
- Ensure failed writes do not leave a database record marked READY or an untracked partial object.
- Ensure database/file operations have explicit compensation and cleanup behavior for partial failures.
- Never expose internal storage keys or absolute filesystem paths in public API responses or error messages.

## 5. Upload and asset-ingestion workflow

### 5.1 Admin authorization

- Uploads require the existing authenticated database-backed ADMIN role.
- Mutating requests retain the existing exact trusted-Origin protection.
- No public upload endpoint, unauthenticated admin path, browser-supplied role, hard-coded credential or temporary authorization bypass is permitted.
- Admin upload and deletion actions must be covered by tests proving that unauthenticated and non-admin callers are rejected.

### 5.2 Upload transport

- Implement a multipart upload route using a streaming or bounded upload parser; do not raise the global JSON body limit to accommodate media.
- Enforce configurable, documented maximum upload sizes by media kind.
- Enforce request/file-count limits and reject malformed or unexpected multipart fields.
- Do not buffer unbounded video files entirely in application memory.
- Apply safe request timeouts and cleanup for interrupted uploads.
- Do not trust client-supplied filename extensions or MIME headers.

### 5.3 File verification

Before an asset becomes READY:

- Verify the file signature/content using a maintained MIME detection mechanism, not only the browser-provided MIME type.
- Enforce an explicit allowlist of formats per media kind.
- Reject MIME/media-kind mismatches, empty files, oversized files, malformed content and unsupported formats.
- Calculate SHA-256 while streaming the upload.
- Capture supported image dimensions and video duration where safely available; optional metadata must remain nullable when it cannot be established reliably.
- Preserve the existing checksum uniqueness behavior and return a safe conflict response for duplicate content if the product policy chooses deduplication.
- Ensure extension, detected MIME type and persisted metadata remain consistent.

### 5.4 Processing states and failure handling

Use the existing `PENDING`, `READY` and `FAILED` processing states consistently.

- A newly received upload begins as PENDING.
- Only fully written and verified files can become READY.
- Validation, storage or metadata failures must not result in a READY asset.
- Failed operations must clean temporary files and reconcile any persisted metadata.
- If a database write succeeds but final file promotion fails, the asset must not be publicly deliverable and must be marked/reconciled as failed.
- Provide a controlled way for an administrator to inspect failed asset metadata and retry only safe, supported operations; do not introduce a background queue unless implementation evidence shows it is required.

### 5.5 Asset lifecycle and deletion

- Integrate file deletion with existing asset deletion and relation-protection rules.
- Do not delete a file while an anime, episode-media relation or subtitle track still references the asset.
- Prevent public delivery immediately when an asset is no longer eligible, even if physical cleanup is pending.
- Define safe orphan cleanup for interrupted/failed operations; cleanup must be constrained to the configured storage root and application-generated keys.
- Do not add destructive bulk cleanup without a dry-run/reporting path and tests.

## 6. Media delivery and access policy

### 6.1 Application-owned delivery route

Implement a same-origin, application-owned media delivery route, proposed as:

- `GET /api/v1/media/:assetId`

The exact route contract must be finalized with shared validation and API types before implementation. The route must resolve an internal asset ID through PostgreSQL and the storage adapter. It must never accept a URL, storage path, arbitrary key or caller-selected redirect destination.

### 6.2 Public eligibility

Public delivery is allowed only when the asset is READY, the underlying file exists and its metadata is valid, and the asset is attached to content that is publicly published:

- Poster/banner: attached to a PUBLISHED anime.
- Episode video/subtitle: attached to a PUBLISHED episode whose parent anime is PUBLISHED.

If an asset is unattached, pending, failed, missing, corrupt, archived-only or otherwise ineligible, public delivery must fail closed. Admin-only preview, if needed, must be a separately authorized behavior and must not weaken public access rules.

### 6.3 HTTP behavior

- Set a verified Content-Type and safe Content-Disposition policy.
- Set `X-Content-Type-Options: nosniff`.
- Support GET and HEAD where appropriate.
- Implement correct single-byte-range behavior for video seeking, including valid partial responses, Content-Range, Content-Length and 416 handling for unsatisfiable ranges.
- Handle missing files and stale database metadata without leaking internal paths.
- Avoid unsafe caching of admin-only or non-public assets. Public immutable caching may be used only when its invalidation semantics are explicit.
- Do not implement arbitrary range fan-out, multi-range complexity or redirect-based delivery unless a concrete browser requirement is demonstrated and tested.

## 7. Playback API and subtitle contracts

### 7.1 Playback metadata

Implement an endpoint proposed as:

- `GET /api/v1/episodes/:episodeId/playback`

It must validate the episode identifier; return only data for a published episode under a published anime; include only READY, verified, attached first-party video assets; return safe same-origin media URLs, MIME type, size and supported quality labels; identify the selected default asset deterministically; include only eligible attached subtitle tracks with language, label, format, default selection and same-origin delivery URL; and return a consistent unavailable/not-found response when the episode is unpublished, missing or has no playable first-party video.

Do not expose storage keys, local paths, checksums unless explicitly required, internal failure details or arbitrary remote URLs.

### 7.2 Video formats and playback

- Define a deliberately small allowlist of browser-playable first-party formats, with MP4/H.264 + AAC as the preferred baseline where the actual uploaded file is compatible.
- WebM may be supported when its codecs are identified and supported by the target browsers.
- Do not claim that changing a file extension or MIME header converts a codec.
- Do not introduce transcoding, FFmpeg workers, HLS packaging, adaptive-bitrate generation or background media processing in the initial implementation unless a separately reviewed technical decision adds it to this scope.
- HLS.js/Video.js may be used only for application-owned media formats that Samren itself stores and can validate. No remote manifests, external segment URLs, provider streams or third-party playback fallbacks.
- Prefer the simplest player integration that meets browser compatibility and accessibility requirements. Record actual supported codecs and browser behavior in the final audit.

### 7.3 Subtitles

- Support WebVTT as the browser-native playback baseline.
- Preserve the existing SRT/VTT/ASS metadata contract, but do not falsely advertise a format as browser-playable when no safe conversion or browser support exists.
- If SRT-to-WebVTT conversion is implemented, use a maintained parser/converter, validate cues and timestamps, and test malformed input.
- ASS playback/conversion is not assumed; either implement and test a safe conversion path or show the track as unsupported/unavailable in playback metadata.
- Support language selection, labels and deterministic default-track selection.
- Subtitle delivery must obey the same published-content and READY-asset checks as video delivery.

## 8. Frontend scope

### 8.1 Artwork

- Replace placeholder poster/banner presentation with real first-party asset delivery when a published asset is available.
- Provide intentional fallback artwork when no eligible asset exists or loading fails.
- Do not hotlink remote artwork or use external image APIs.

### 8.2 Watch route and player

Add the watch experience using an application route such as `/watch/:animeSlug/:episodeId`.

The page must load published anime/episode context and playback metadata from Samren; render a responsive player with play/pause, seek, volume, mute, fullscreen and playback status; support eligible subtitle tracks; show episode and anime context; provide previous/next navigation using stable published episode order; disable navigation at boundaries; distinguish loading, unavailable, not-found, network and playback errors; never attempt external fallback; provide keyboard-accessible controls and visible focus; and respect `prefers-reduced-motion` and usable mobile layouts.

Use Video.js/HLS.js only if the selected supported formats require them. The repository currently does not list these packages as installed frontend dependencies; any dependency addition must be justified, version-pinned through the workspace lockfile and verified in CI.

### 8.3 Playback progress

- Store playback progress locally in the browser for this phase, with bounded and versioned storage data.
- Restore progress only for the same episode and valid media duration.
- Provide a sensible resume/restart behavior without requiring a user account.
- Do not add server-synchronized watch history, cross-device progress, watchlists or personal-library functionality; those remain Phase 4.

## 9. Proposed API surface

All routes remain under `/api/v1`. Names are proposals and must be reconciled with existing route conventions and shared contracts before coding.

| Method and route | Purpose | Access |
|---|---|---|
| `POST /admin/catalog/assets/upload` | Multipart upload and verified asset creation | ADMIN + trusted Origin |
| `GET /admin/catalog/assets/:assetId/status` | Inspect processing and storage verification state | ADMIN |
| Existing `PATCH /admin/catalog/assets/:id` | Update allowed metadata only | ADMIN + trusted Origin |
| Existing `DELETE /admin/catalog/assets/:id` | Safely delete unused metadata and file | ADMIN + trusted Origin |
| `GET /media/:assetId` | Deliver an eligible first-party asset | Published-content policy |
| `GET /episodes/:episodeId/playback` | Return playable first-party video and subtitle metadata | Published-content policy |

The existing admin asset metadata endpoint must not be repurposed to accept an unvalidated filesystem path. Any compatibility change must be documented and tested.

## 10. Configuration and operational documentation

Define and validate only settings required by the selected local-storage implementation. Expected configuration candidates include:

- `MEDIA_STORAGE_ROOT` — absolute local storage root.
- Per-kind upload size limits — documented defaults and validated positive bounds.
- Any upload timeout or temporary-file policy required by the chosen parser.

Do not add credentials or cloud-provider configuration. Update environment examples and operational documentation with storage directory creation and permissions, persistence and disk-space requirements, backup/restore considerations for both PostgreSQL and the media directory, safe migration of the storage root, supported formats and upload limits, failed-upload/orphan recovery, and limitations of local storage on multi-instance deployments.

Do not claim a backup is complete unless both the database metadata and media bytes are included and a restore is tested.

## 11. Testing and verification plan

### Backend unit and integration tests

- Storage key validation and root confinement.
- Path traversal, absolute paths, symlink escape and malformed key rejection.
- Successful upload, checksum, metadata and state transitions.
- MIME signature/content validation and media-kind mismatch rejection.
- Empty, malformed, oversized and interrupted upload handling.
- Temporary-file cleanup and database/filesystem partial-failure recovery.
- ADMIN authorization and trusted-Origin enforcement.
- In-use asset deletion protection and orphan cleanup boundaries.
- Published/unpublished visibility rules for artwork, video and subtitles.
- Missing/corrupt file behavior and no internal-path leakage.
- GET, HEAD, valid range, suffix range, invalid range and unsatisfiable range behavior.
- Playback response selection, default selection, deterministic ordering and no-asset states.
- Subtitle format handling and malformed subtitle behavior.

### Frontend tests

- Artwork success, fallback and failure states.
- Watch route loading, not-found, unavailable, network and playback errors.
- Play/pause and player state integration.
- Subtitle selection and default selection.
- Previous/next navigation boundaries.
- Resume progress validation and storage corruption handling.
- Keyboard access and accessible labels for controls.
- No third-party URLs or provider fallback in playback behavior.

### CI and build gates

- Use an isolated temporary filesystem root for storage tests.
- Ensure tests clean up temporary files even after failures.
- Run Prisma validation/generation and migration checks where schema changes are justified.
- Run lint, typecheck, backend tests, frontend tests and production builds.
- Keep CI installs immutable using the committed lockfile.
- Verify no uploaded media or runtime storage data is committed.
- Review active runtime and built frontend output for prohibited external provider/stream integrations.

No local Docker assumption is required. PostgreSQL-backed integration tests should use the existing CI PostgreSQL service. Do not claim a check passed unless its output or CI result confirms it.

## 12. Delivery sequence and review checkpoints

1. **3.1 — Design and contracts:** inspect existing Phase 2 asset/auth contracts; finalize storage interface, route schemas, format allowlists, limits and error model. Review any required dependency changes before adding them.
2. **3.2 — Local storage foundation:** implement root validation, safe keys, atomic writes, reads, deletion and isolated storage tests.
3. **3.3 — Secure admin ingestion:** implement bounded multipart uploads, verification, checksum, state transitions, authorization and safe cleanup.
4. **3.4 — Asset delivery:** implement publication eligibility, safe headers, HEAD/GET and byte-range delivery.
5. **3.5 — Playback and subtitle API:** implement published episode playback metadata, video selection and supported subtitle contracts.
6. **3.6 — Frontend artwork and watch experience:** integrate first-party artwork, responsive player, subtitle controls, episode navigation and local progress.
7. **3.7 — Integration/security verification:** run complete API, filesystem, player, accessibility and CI tests; audit for prohibited integrations and data leakage.
8. **3.8 — Final audit and freeze:** document verified behavior, limitations, operational setup and remaining risks. Freeze Phase 3 only after every acceptance gate passes.

Each checkpoint must be reviewed before proceeding to the next. If a step requires scope expansion, stop and request approval rather than silently adding it.

## 13. Acceptance gates

Phase 3 is complete only when all applicable gates are verified:

- [ ] Local storage root is validated, persistent, private and outside public web roots.
- [ ] Storage keys are application-generated and cannot escape the configured root.
- [ ] Admin upload is bounded, streaming, validated and protected by existing ADMIN + trusted-Origin checks.
- [ ] MIME/content, media-kind, file size and checksum are verified.
- [ ] Asset state transitions and failure cleanup are correct.
- [ ] Files and database metadata remain consistent across partial failures.
- [ ] In-use assets cannot be destructively deleted.
- [ ] Public artwork delivery requires a READY asset attached to published anime.
- [ ] Public episode media/subtitle delivery requires a READY asset attached to a published episode and published anime.
- [ ] GET/HEAD and HTTP byte-range seeking behavior pass integration tests.
- [ ] No arbitrary path, URL fetch, redirect target or public storage-directory exposure exists.
- [ ] Watch page plays a supported first-party video file and shows intentional unavailable/error states.
- [ ] Subtitle selection works for the formats explicitly declared supported.
- [ ] Previous/next episode navigation respects published episode ordering and boundaries.
- [ ] Local playback progress restores safely without introducing Phase 4 account features.
- [ ] Frontend controls are responsive, keyboard accessible and respect reduced motion.
- [ ] Backend, frontend, filesystem, authorization and delivery tests pass.
- [ ] Lint, typecheck, tests and production builds pass in CI.
- [ ] Runtime, dependencies, environment files and build output contain no external anime API, scraper, provider, third-party embed, remote stream, proxy or fallback integration.
- [ ] No changes are made to Anime-streaming or unrelated legacy Samren applications.
- [ ] Final audit records actual evidence and explicit limitations.

## 14. Explicitly deferred

The following are not part of Phase 3:

- S3 or other cloud/object storage implementation.
- CDN, multi-region or multi-host storage replication.
- FFmpeg transcoding, adaptive-bitrate generation, HLS packaging and background media-processing workers.
- External media hosting, streaming providers, embeds, source resolvers, scraping or stream proxies.
- Public user registration, account recovery, MFA, role management or session redesign.
- Server-synchronized watch history, cross-device resume, watchlists, favourites and personal library.
- Downloads/offline playback and DRM.
- Production deployment, production backup automation, disaster recovery and capacity/load certification.

Any proposal to add one of these requires a separate scope decision before implementation.

## 15. Approval and phase status

**Product-owner decision recorded:**
- Full proposed Phase 3 scope: APPROVED.
- Local managed filesystem storage: APPROVED.
- Planning document creation: APPROVED.

**Implementation authorization: NOT GRANTED.**

No Phase 3 implementation may begin until the user reviews this document and gives a separate, explicit instruction authorizing implementation. Phase 2 remains complete and frozen. Phase 3 remains NOT STARTED until that authorization is received.
