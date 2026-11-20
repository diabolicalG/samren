# Samren Phase 3 — Readiness Audit

**Audit date:** 2026-11-20  
**Repository under change:** `diabolicalG/samren`  
**Read-only architecture reference:** `diabolicalG/Anime-streaming`  
**Main baseline inspected:** `05b7d859dbcc42aec03a782039c47fd22404625e`  
**Existing implementation branch:** `phase-3-media-providers`  
**Existing PR:** [#5](https://github.com/diabolicalG/samren/pull/5)  
**PR head inspected:** `fbf22b29470b9eb78dae6decafe8f94127f2978f`  
**Latest inspected CI run:** [43996289197](https://github.com/diabolicalG/samren/actions/runs/43996289197) — completed successfully.

## 1. Executive decision

**Readiness result: CONDITIONALLY READY FOR CHECKPOINTED REMEDIATION; NOT READY TO MERGE OR RELEASE.**

Phase 3 is not starting from zero. The existing Samren feature branch already contains substantial first-party media and Anivexa work, and its latest inspected CI run passed. Rebuilding those pieces from scratch would duplicate work.

However, the branch is not accepted or frozen. Important security, architecture, integration, licensing, UX and real-browser verification gaps remain. The current PR is a draft, GitHub reports it as not mergeable, and its comparison with `main` reports 434 commits ahead and one behind. It changes 111 files with approximately 18,042 additions and 23 deletions. Do not merge or deploy it as-is.

Continue from the existing work only after reconciling it against the current Samren main baseline. Keep Phase 1 and Phase 2 behavior frozen.

## 2. Approved scope and repository boundary

The revised Phase 3 scope on the feature branch records the user's 2026-11-15 Option B decision:

- Implement first-party local media storage, uploads, delivery, artwork and playback in Samren.
- Adapt the Kuhi client/service path using the Anime-streaming repository as a read-only reference.
- Integrate Anivexa provider and extractor behavior natively into Samren rather than requiring a separately operated Anivexa service.
- Keep first-party uploaded assets separate from transient provider-resolved streams.
- Do not expose provider secrets, cookies, private headers or arbitrary remote URLs.
- Do not build an unrestricted proxy.
- Keep Phase 1 and Phase 2 frozen; do not start Phase 4 account/library features in this phase.

**Repository rule:** all implementation commits must be made only in `diabolicalG/samren`. `diabolicalG/Anime-streaming` may be inspected for architecture, contracts, provider behavior and reference implementations, but no file, branch, setting, issue, pull request or commit in that repository may be changed.

The Anime-streaming reference was only read during this audit. No write operation was made against it.

## 3. Existing work verified in Samren

### 3.1 First-party media

The feature branch already contains:

- Application-generated opaque storage keys.
- A local filesystem storage adapter with atomic temporary writes, incremental SHA-256 hashing and restrictive directory/file permissions.
- Bounded streaming upload support and multipart parsing.
- File-signature checks for JPEG, PNG, WebP, AVIF, MP4, WebM, WebVTT, SRT and ASS.
- PENDING → READY/FAILED asset lifecycle handling.
- Startup reconciliation for stale pending uploads and old orphaned managed files.
- ADMIN and trusted-Origin protection on upload.
- Publication-aware GET/HEAD media delivery and single-byte-range support.
- First-party playback metadata, catalogue artwork URLs, a watch route, episode navigation, local progress, quality selection and WebVTT subtitle rendering.
- SRT-to-WebVTT conversion for first-party subtitles.

### 3.2 Provider integration

The feature branch already contains:

- An Anivexa adapter registry and provider discovery/extraction routes.
- Provider aggregation with bounded worker concurrency, queue limits, circuit breakers and short-lived in-memory playback sessions.
- HTTPS hostname allowlists, DNS pinning, redirect revalidation, timeouts and bounded upstream response sizes.
- HLS and DASH manifest rewriting and a same-origin media relay.
- HLS.js and dash.js player integration, source fallback and source-switch progress restoration.
- Anivexa disabled by default; upstream and stream host allowlists are empty by default and must be explicitly configured.

The branch's progress/audit documents report 11 registered Anivexa provider adapters, with some provider-specific caveats and unsupported paths. Provider registration must not be described as proof that all providers are live or playable.

### 3.3 Automated verification

The latest inspected GitHub Actions run `43996289197` completed successfully. Its workflow passed PostgreSQL migration/seed steps, lint, TypeScript typecheck, backend tests, frontend jsdom smoke/accessibility tests, Python API tests and production builds.

This is useful CI evidence, but it does **not** prove real browser playback, live provider availability, production storage durability, codec compatibility or subtitle synchronization.

## 4. Blocking findings

These findings must be resolved before Phase 3 can be accepted.

### P0-1 — Provider media relay accepts a client-supplied upstream URL

Current relay URLs are shaped like:

`/api/v1/anivexa/media?url=<upstream-url>&referer=<provider-referer>`

The backend validates the target hostname against the configured stream-host allowlist and uses the pinned HTTPS transport. That is materially safer than an unrestricted internet proxy, but the client still chooses the complete upstream URL/path and can ask the server to fetch arbitrary resources on any configured stream host. The raw upstream URL and referer are also visible in browser-facing query strings and can leak into logs.

The approved scope explicitly prohibits arbitrary client-supplied URLs as server-side fetch targets.

**Required correction:** replace raw URL/referer query parameters with opaque, short-lived, integrity-protected media resource handles bound to a server-created playback session. Only a provider-resolved root manifest/source and child resources discovered while parsing its manifest may be registered. Each request must resolve the opaque handle server-side, revalidate host policy and session expiry, and never accept a caller-selected upstream URL or referer. Do not expose raw provider URLs or referers in browser-facing URLs.

### P0-2 — Kuhi is not integrated into the active Samren runtime

The feature branch adds Kuhi functionality under the older Python `apps/api` tree. The active root pnpm workspace contains `apps/frontend`, `apps/backend` and shared TypeScript packages; it excludes `apps/api`. The current frontend watch page calls the Anivexa aggregation client and does not expose a Kuhi playback path. The active Express backend has no corresponding Kuhi provider module.

Therefore, the branch's Python Kuhi additions do not currently establish a working Kuhi path in Samren's active application.

**Required correction:** adapt the reference `apps/backend/src/services/streaming/KuhiProvider.ts` contracts into the active Samren TypeScript backend, or provide a separately reviewed, explicitly operated service boundary if the accessible Kuhi API source is required. Wire the resulting provider into Samren's provider selection/fallback flow. Preserve the Kuhi API v3 MIT attribution from `apps/kuhi-api/LICENSE`. Do not copy the Anime-streaming Git submodule without resolving its canonical source and provenance.

### P0-3 — Provider playback requires users to manually enter an AniList ID

The current Prisma `Anime` model has no AniList ID or external identity relation. The watch page asks the viewer to manually enter an AniList ID before provider fallback can start.

This makes provider playback fragile and shifts identity resolution to the user. It also prevents reliable automatic mapping from Samren catalogue entries to Kuhi/Anivexa provider catalogues.

**Required correction:** introduce an explicit, admin-managed external identity mapping for the local Anime record (at minimum a validated unique nullable AniList ID, or a dedicated mapping relation if multiple external identities are needed). Add the appropriate Phase 3 migration, admin validation/editing, API contract and tests. The watch page must resolve the mapping from the local anime record and must not ask viewers to guess or manually supply an ID. Do not silently guess a mapping from title alone; any automated match must be confidence-scored and confirmed before persistence.

### P0-4 — Provider endpoints lack per-client rate limiting

The worker pool and queue bound concurrent provider work, but the public discovery, extraction, aggregation, fallback and media relay endpoints have no visible per-client rate-limit middleware. A caller can repeatedly trigger expensive upstream provider work or media relay requests.

**Required correction:** add bounded per-client throttling for provider discovery/extraction/session creation/fallback and media relay requests, with explicit limits, safe 429 responses and tests. Document that process-local limits are defense in depth and that production multi-instance deployments also require shared edge/reverse-proxy limits. Do not claim distributed rate limiting unless it is implemented and tested.

### P0-5 — No real-browser playback verification

Current frontend tests run in jsdom and mock HLS.js/dash.js APIs. They do not load real browser engines or media. The latest CI run therefore does not verify actual MP4/WebM playback, HLS/DASH manifest loading, seeking, source switching, subtitle rendering, mobile controls or episode navigation in a browser.

**Required correction:** add browser-based E2E coverage in CI using representative local fixture media and a controlled test origin. Verify first-party MP4 playback, byte-range seeking, HLS/DASH engine initialization and manifest/segment relay, source switching, subtitle behavior, progress restore, navigation and failure states. Live provider smoke tests should be separate and must not make ordinary CI depend on third-party uptime.

### P0-6 — Legacy Python API changes are outside the approved implementation boundary

The existing PR modifies the older `apps/api` Python application and its requirements, environment, providers, routes and tests. That tree is outside the active pnpm workspace and was intentionally retained as legacy during Phase 1/2. The Phase 3 scope says not to refactor legacy Samren applications unless a directly necessary change is separately documented.

The Python Kuhi additions are not wired into the active frontend/Express runtime, so they are not a sufficient reason to extend the legacy runtime.

**Required correction:** remove the Phase 3-only modifications to the legacy Python API from the active Phase 3 change set and restore its pre-Phase-3 state. Keep the existing legacy source untouched. Move the required Kuhi integration into the active Samren backend or define a separate service boundary explicitly. Remove Python-only CI work that exists solely to validate the out-of-scope legacy modifications.

### P0-7 — Anivexa source licensing/provenance is unresolved

The Anime-streaming reference's `apps/anivexa-api` and the identified upstream Anivexa API repository did not expose a LICENSE file at the inspected paths. The reference README identifies a separately maintained upstream project. The Kuhi API v3 source, by contrast, includes an MIT license.

**Required correction:** do not assume the Anivexa implementation is licensed for copying. Before retaining any copied/adapted provider implementation, establish permission or a compatible license. Otherwise replace it with clean-room adapters based on documented/public endpoint behavior and the reference architecture, without copying upstream implementation text. Preserve required attribution for licensed components. Do not copy embedded credentials, execute provider JavaScript, use shell execution or add browser/request-impersonation dependencies without a separate security and licensing review.

## 5. High-priority hardening findings

1. **Filesystem symlinks:** `readStoredMediaStat` uses `stat()`, which follows a symlink. Use `lstat()` and reject symlink/non-regular files at the read boundary. Add tests for symlink escape and file replacement.
2. **Metadata consistency:** public delivery uses the on-disk size but does not compare it with the stored `MediaAsset.sizeBytes`. Verify persisted size and expected file type before delivery; fail closed on mismatch.
3. **Production storage configuration:** `MEDIA_STORAGE_ROOT` defaults to relative `.data/media` even in production. Require an explicitly configured absolute persistent path in production, validate it at startup and document permissions, persistence and disk-space requirements.
4. **Upload limits:** per-kind upload limits are hard-coded in the route. Move them into validated configuration with documented defaults and enforce the same values in the frontend and backend.
5. **Upload status route:** the approved scope proposes `GET /admin/catalog/assets/:assetId/status`; no such status route was found in the inspected media admin router. Implement it with ADMIN authorization and safe metadata only, or explicitly amend the scope if it is no longer needed.
6. **Upload timeout/cleanup:** verify request timeout behavior for large/interrupted uploads and ensure disconnects always remove multipart staging files and reconcile PENDING assets.
7. **Content validation:** current signature checks establish container/file signatures, not full decodability or browser codec compatibility. Do not claim every MP4/WebM is playable. Validate supported content more deeply where practical and record unsupported codecs/formats explicitly.
8. **Provider subtitles:** provider subtitle URLs are passed to native HTML `track` elements without a verified format/conversion contract. Native tracks require WebVTT. Verify content and convert supported SRT safely, or omit unsupported formats rather than advertising them as playable.
9. **Browser-local progress:** the watch page reads/writes `window.localStorage` directly. Guard against blocked storage, quota errors, malformed values and invalid durations; add corruption/unavailable-storage tests.
10. **Adaptive player dependencies:** HLS.js and dash.js are loaded dynamically from third-party CDNs with version-pinned URLs but no Subresource Integrity. Prefer pinned workspace dependencies and lazy imports/bundling, or provide a reviewed integrity policy. Update CSP accordingly.
11. **Range edge cases:** extend byte-range tests for suffix ranges larger than the file, empty/malformed ranges, HEAD with ranges, and file-size changes between metadata lookup and stream open.
12. **Session lifecycle:** provider sessions and circuit state are in-process memory. Closing/expiring a session currently does not cancel already-running provider tasks. Add abort/cancellation propagation and document single-process limits; do not claim multi-instance support.
13. **Provider URL validation consistency:** align URL validation with transport rules, including HTTPS port policy, host allowlists, redirects, DNS pinning and stream/subtitle URL handling.
14. **CORS example mismatch:** `apps/backend/.env.example` says `CORS_ORIGIN=http://localhost:3000`, while the active Express environment default and Vite frontend use `http://localhost:5173`. Correct the example and add a configuration smoke test.
15. **Documentation drift:** the root README still describes the legacy Next.js/FastAPI/Shivra stack rather than the active React/Vite + Express/TypeScript + Prisma workspace. The feature branch progress header also reports an older latest code checkpoint than the PR head. Correct documentation before release.

## 6. Explicitly deferred work — do not pull into Phase 3

Keep these items out of this phase unless separately approved:

- Phase 4 registration/account recovery, watchlists, favourites, server-synchronized history and cross-device progress.
- S3/cloud storage, CDN, multi-region or multi-host replication.
- FFmpeg transcoding, HLS packaging/adaptive-bitrate generation and background media-processing workers.
- DRM/EME.
- Downloads/offline playback.
- Production disaster recovery and capacity certification beyond documenting and testing the actual single-host deployment boundary.

## 7. Checkpoint plan after this audit

The existing branch contains partial implementations of several checkpoints. The next work must be remediation and completion, not a blind restart.

| Checkpoint | Work | Exit evidence |
|---|---|---|
| 3.1 — Contracts and branch reconciliation | Resolve scope/licensing provenance; remove out-of-scope legacy Python changes; reconcile feature branch with current Samren main; define opaque session-bound media handles; define AniList identity mapping; add Kuhi to active backend design; define rate-limit and upload configuration contracts | Reviewed contracts, clean Samren-only diff, no Anime-streaming writes |
| 3.2 — Storage hardening | Symlink-safe reads, production root validation, size/type consistency, configured upload limits, safe status endpoint and failure cleanup | Storage unit/integration tests pass |
| 3.3 — Secure ingestion | Harden multipart/raw upload, request disconnect/timeouts, file validation, checksum/state transitions and admin authorization | Upload lifecycle/security tests pass |
| 3.4 — First-party delivery | Publication eligibility, safe headers, GET/HEAD/range edge cases, integrity and missing-file handling | Database/filesystem delivery integration tests pass |
| 3.5 — Playback contracts and providers | Published playback metadata, WebVTT contract, Kuhi client/provider integration, clean-room/licensed Anivexa adapters, AniList mapping and session-bound media relay | Provider, mapping, relay, SSRF and subtitle tests pass |
| 3.6 — Frontend playback | Artwork, player, HLS/DASH/MP4 handling, source switching, progress safety, subtitles, episode navigation and accessible states | Component tests and real-browser E2E pass |
| 3.7 — Integration/security verification | Rate limits, cancellation, SSRF/DNS/redirect tests, Phase 2 regression, browser tests and full CI | All CI gates pass; no prohibited legacy/reference changes |
| 3.8 — Final audit and freeze | Record actual evidence, unsupported formats/providers, operational setup and residual risks | Every approved acceptance gate is verified; Phase 3 formally accepted |

**Checkpoint rule:** finish one checkpoint, run its tests, inspect the resulting diff and record an audit before starting the next. If an implementation change needs scope expansion, stop and document it before proceeding.

## 8. Final readiness statement

The existing branch demonstrates meaningful progress and a successful automated CI run, but it is not merge-ready or release-ready. The most important corrections are the client-controlled provider media relay, missing active-runtime Kuhi integration, manual AniList ID entry, missing per-client rate limits, unresolved Anivexa licensing/provenance, out-of-scope legacy Python changes and absence of real-browser playback verification.

All remediation commits must remain in Samren. Anime-streaming remains a read-only reference and must remain unchanged.

 
---

## 9. Reconciliation and provenance addendum — 2026-11-20

The initial audit above records the state observed before branch reconciliation. The following follow-up supersedes its branch-status and legacy-Python observations:

- Reconciliation commit: `99977f0600b6ecab56db39bdff9ea77f0b30af09`.
- Current Samren main (`05b7d859dbcc42aec03a782039c47fd22404625e`) is now a parent of the feature branch.
- The branch comparison reports **zero commits behind main**. The raw GitHub PR API reports `mergeable=true`; PR #5 remains draft/open/unmerged.
- The PR diff was reduced to 84 files, approximately 10,702 additions and 95 deletions at the reconciliation checkpoint.
- Phase 3-only changes to legacy `apps/api` were removed from the feature diff; its existing files were restored to main-branch versions. The Python test workflow step added for those changes was also removed.
- Root README now describes the active React/Vite + Express/TypeScript workspace. The active backend CORS example now matches Vite's `http://localhost:5173` origin.
- The full technical contracts are recorded in [PHASE_3_CONTRACTS.md](./PHASE_3_CONTRACTS.md).

### Additional reference-source findings

- The accessible Kuhi API v3 source includes an MIT license, but its service shell also contains wildcard CORS and public `/proxy_m3u8` / `/proxy_segment` routes accepting caller-supplied URLs. The approved Samren design excludes those proxy routes and uses only a loopback provider service with the required search/episode/extraction operations.
- The Anivexa source provenance review found exact/near-exact line matches in three current Samren files: `animegg.js` (100% matching non-empty lines), `new-provider-utils.js` (100%) and `vidplay.js` (exact match). No applicable Anivexa LICENSE was found at the inspected reference/upstream paths. These files must be clean-room rewritten or cleared by a compatible license/permission before release.
- The existing provider relay still uses client-controlled raw URL/referer query parameters. It remains a blocking issue and is scheduled for replacement with opaque session-bound resource handles.
- No write operation has been made to `diabolicalG/Anime-streaming`.

### CI status at this update

The reconciliation commit triggered CI run [44735651560](https://github.com/diabolicalG/samren/actions/runs/44735651560). It was in progress when this addendum was prepared. Do not mark Checkpoint 3.1 complete until the workflow result is verified and the progress/provider audit documents are aligned.


### CI and checkpoint acceptance update — 2026-11-20

Reconciliation CI run [44735651560](https://github.com/diabolicalG/samren/actions/runs/44735651560) completed successfully. Its single `foundation` job passed Prisma validation/client generation, PostgreSQL migration, deterministic seed/idempotence, lint, TypeScript typecheck, backend API tests, frontend smoke/accessibility tests and frontend/backend production builds. It no longer runs the out-of-scope legacy Python API tests.

The feature branch is now zero commits behind Samren main; the raw GitHub PR API reports `mergeable=true`. PR #5 remains draft and unmerged. The legacy Python changes were removed from the Phase 3 diff, the active README/CORS example were corrected, and the detailed contracts are recorded in [PHASE_3_CONTRACTS.md](./PHASE_3_CONTRACTS.md).

**Checkpoint 3.1 — Contracts and branch reconciliation: ACCEPTED.** This acceptance does not accept Phase 3 as a whole and does not authorize merging PR #5. Continue with Checkpoint 3.2 and audit it before proceeding.


### Checkpoint 3.2 audit — 2026-11-20

**Verdict: ACCEPTED.** Samren storage hardening was implemented in commits `71c046a`, `0efdc264` and `6ee0e93`. The final CI run [44737230985](https://github.com/diabolicalG/samren/actions/runs/44737230985) passed every active-workspace gate, including lint, typecheck, backend API tests, frontend smoke/accessibility tests and production builds.

Verified changes: generated-key reads reject symlinked files/shards; reads use `O_NOFOLLOW` where supported and verify the opened descriptor is a regular file; database `sizeBytes` must match the opened file before public delivery; storage-root symlinks are rejected; production requires an explicit absolute root and rejects known repository public directories; byte-range parsing handles oversized suffix ranges correctly; and tests cover these cases plus HEAD behavior and subtitle-size consistency.

Residual limits: production persistence and backup/restore are not operationally certified; deployment-specific public/static roots must be configured outside media storage; stored SHA-256 values are not recomputed on every read; upload size limits remain hard-coded, the admin asset-status endpoint is still missing, and upload timeout/disconnect hardening belongs to Checkpoint 3.3.

No changes were made to `diabolicalG/Anime-streaming`. Continue to Checkpoint 3.3 only after this audit; do not skip the next audit gate.


### Checkpoint 3.3 audit — 2026-11-20

**Verdict: ACCEPTED.** Secure ingestion and administrator diagnostics are implemented in Samren. CI run [44737814111](https://github.com/diabolicalG/samren/actions/runs/44737814111) completed successfully with all active-workspace gates passing.

Verified: validated environment-based per-kind upload limits (15 MiB image, 2 GiB video, 2 MiB subtitle defaults); an ADMIN-only `GET /admin/catalog/assets/upload-limits`; frontend upload preflight driven by those server values; an ADMIN-only asset status endpoint returning `PRESENT`, `MISSING`, `SIZE_MISMATCH`, `NOT_MANAGED` or `UNAVAILABLE` without exposing storage keys/paths; a configurable request timeout; request-abort checks before finalization; and cleanup of multipart temp directories/partial managed files on failure. Backend tests verify auth boundaries, dynamic limit values and file-state reporting. Frontend smoke/accessibility tests and production builds pass.

Residual limits: upload throttling is not yet implemented; request timeout is applied at the Node server level rather than only to upload routes; no malware scanner or deep codec probe is included; browser-disconnect behavior is not yet exercised in a real-browser E2E test; and the status endpoint reports filesystem presence/size, not a full checksum revalidation. These remain release-hardening items.

**Checkpoint 3.3 accepted.** Proceed to Checkpoint 3.4 — review first-party delivery/publication gating and end-to-end range behavior. Anime-streaming remains read-only.


### Active frontend and delivery audit correction — 2026-11-20

The current active React/Vite application registers Home, Browse, Search, Anime detail and Admin routes. It does **not** register a watch route and does not consume apiClient.catalogPlayback. The watch page and manual AniList ID entry mentioned in earlier findings belong to legacy apps/web, which is excluded from the active workspace. Those legacy UI capabilities must not be counted as implemented in the active application. The active frontend player, source switching, subtitle controls, episode navigation and browser-local progress remain outstanding for Checkpoint 3.6.

The backend does have first-party media delivery and a catalogue playback metadata endpoint. The implemented canonical metadata route is GET /api/v1/catalog/anime/:slug/episodes/:episodeNumber/playback, reconciled to Samren's catalogue route convention. It now filters by published episode/anime, READY asset, media kind, supported MIME, subtitle format/MIME match and actual managed file/size availability. Delivery enforces matching published associations and media kind. Checkpoint 3.4 and subcheckpoint 3.5A are audited separately; overall 3.5 remains open for provider/security integration.

CI run [44738805397](https://github.com/diabolicalG/samren/actions/runs/44738805397) passed all active-workspace gates. See the dedicated checkpoint audit documents for evidence and remaining limitations.
