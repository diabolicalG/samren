# Samren Phase 3 — Implementation Progress

**Status:** IN PROGRESS — not accepted or frozen  
**Branch:** `phase-3-media-providers`  
**Main baseline:** `05b7d859dbcc42aec03a782039c47fd22404625e` (merged into the feature branch)  
**Latest existing implementation code:** `fbf22b29470b9eb78dae6decafe8f94127f2978f`  
**Branch reconciliation:** `99977f0600b6ecab56db39bdff9ea77f0b30af09`  
**Contracts checkpoint document:** [PHASE_3_CONTRACTS.md](./PHASE_3_CONTRACTS.md)  
**Readiness audit:** [PHASE_3_READINESS_AUDIT.md](./PHASE_3_READINESS_AUDIT.md)  
**Pull request:** [#5](https://github.com/diabolicalG/samren/pull/5) (open, draft, not merged)

## 1. Repository boundaries

- Active implementation repository: `diabolicalG/samren`.
- Reference repository: `diabolicalG/Anime-streaming`, read-only.
- No changes have been made to Anime-streaming.
- Phase 1 and Phase 2 remain frozen.
- The active runtime is the React/Vite frontend, Express/TypeScript backend, shared TypeScript packages and Prisma/PostgreSQL.
- The legacy `apps/api` Python gateway is not a Phase 3 target. Phase 3-only changes previously made there were removed from the feature diff and its files restored to the main-branch versions.

## 2. Approved scope

The user-approved Option B amendment includes:
- First-party local media storage, upload, delivery, artwork and playback.
- Kuhi provider integration using the reference TypeScript client contract and accessible MIT-licensed Kuhi API v3 source where required.
- Native Anivexa provider/extractor integration in Samren, without a separately operated Anivexa API service.
- Strict separation between first-party stored assets and transient provider-resolved streams.

The amendment does not authorize arbitrary client-supplied URLs, an unrestricted proxy, exposing provider credentials, copying unlicensed source code, or modifying Anime-streaming.

## 3. Existing first-party media implementation

The feature branch already contains:
- Generated opaque storage keys, root/parent containment checks, atomic temporary writes, SHA-256 checksums and restrictive file permissions.
- Bounded streaming and multipart upload handling.
- Signature checks for JPEG, PNG, WebP, AVIF, MP4, WebM, WebVTT, SRT and ASS.
- PENDING/READY/FAILED asset state transitions and best-effort stale pending/orphan cleanup.
- ADMIN and trusted-Origin upload protection.
- Publication-aware GET/HEAD media delivery and single-byte-range support.
- First-party artwork URLs and episode playback metadata.
- A watch page with source quality selection, episode navigation, browser-local progress and WebVTT subtitle tracks.
- SRT-to-WebVTT conversion for first-party subtitles.

Known hardening still required: reject symlinks at read time, compare stored and on-disk size, require explicit persistent production storage, make upload limits configurable, add the asset status endpoint, harden disconnect/timeouts, validate codecs/formats, guard localStorage and add real-browser tests.

## 4. Provider implementation status

### Anivexa

The current branch registers 11 Anivexa provider adapters and includes:
- Bounded worker concurrency and queue capacity.
- Provider circuit breakers and short-lived in-memory sessions.
- HTTPS host allowlists, DNS-pinned outbound transport, redirect revalidation, timeouts and response-size limits.
- HLS/DASH manifest rewriting and same-origin relay.
- HLS.js/dash.js player integration and provider fallback.

These are implementation facts, not acceptance evidence. No live provider-wide playback or real-browser compatibility has been established. Anivexa remains disabled by default.

**Critical provenance correction:** the reference Anivexa API and its identified upstream repository had no LICENSE file at the inspected paths. Three current Samren files were found to be 100% matching on non-empty source lines: `apps/backend/src/anivexa/providers/animegg.js`, `apps/backend/src/anivexa/core/new-provider-utils.js` and `apps/backend/src/anivexa/extractors/vidplay.js`. These must be replaced with clean-room implementations based on public behavior/protocol contracts or cleared by an applicable license/permission before distribution. Do not treat the current provider set as license-cleared.

**Critical security correction:** the current relay still accepts raw upstream `url` and `referer` query parameters. It must be replaced with short-lived opaque resource handles bound to a provider playback session. Host allowlisting alone does not satisfy the no-user-controlled-destination requirement.

### Kuhi

- The reference contains a TypeScript `KuhiProvider` client and provider contracts.
- The Kuhi service is also present as a Git submodule, but its canonical source URL was not available from the inspected metadata; do not guess or copy that submodule.
- An accessible Kuhi API v3 implementation under `apps/kuhi-api` includes an MIT license.
- The Kuhi API README describes the service as experimental. Its service shell includes wildcard CORS and public `/proxy_m3u8` and `/proxy_segment` routes that accept caller-supplied URLs. Those proxy routes and wildcard CORS must not be copied.
- The earlier Python Kuhi implementation under legacy `apps/api` has been removed from the Phase 3 diff. Kuhi is not yet integrated into the active Express/TypeScript runtime.
- The approved implementation design is an isolated new `services/kuhi-api` component in Samren, exposing only the required provider search/episode/extraction operations, bound to loopback and called by a typed client in the active backend. Preserve MIT license and attribution. All returned media URLs must pass Samren validation and opaque-resource delivery.

### Catalogue mapping

The current `Anime` model has no AniList identity, and the watch page asks viewers to type an AniList ID manually. Add an administrator-managed optional unique AniList ID to the local anime record, with a Phase 3 migration and validation. The playback API must resolve the mapping server-side; viewers must not supply or guess provider IDs.

## 5. Branch reconciliation

At reconciliation commit `99977f0600b6ecab56db39bdff9ea77f0b30af09`:
- Current Samren main was merged as a parent; the feature branch is zero commits behind main.
- The raw GitHub PR API reports `mergeable=true`; PR #5 remains draft and unmerged.
- The PR diff was reduced from 111 files to 84 files by removing Phase 3-only changes to legacy `apps/api`.
- The active CI workflow was restored to the TypeScript/PostgreSQL workspace; the legacy Python test step was removed.
- Root README now documents the active React/Vite + Express/TypeScript runtime.
- `apps/backend/.env.example` now uses `CORS_ORIGIN=http://localhost:5173`.

## 6. Verification evidence and limits

- Earlier CI run [43996289197](https://github.com/diabolicalG/samren/actions/runs/43996289197) passed on the pre-reconciliation implementation head. That workflow still included the legacy Python test step.
- Reconciliation CI run [44735651560](https://github.com/diabolicalG/samren/actions/runs/44735651560) was in progress when this progress update was prepared. Its result must be checked before checkpoint 3.1 is accepted.
- Existing frontend tests use jsdom and mocked media engines. They do not prove real MP4/HLS/DASH playback, seeking, subtitle synchronization or mobile browser behavior.
- No live provider availability guarantee is made.
- Production storage persistence, backup/restore and multi-instance operation have not been certified.

## 7. Checkpoint status

| Checkpoint | Status |
|---|---|
| 3.1 — Contracts and branch reconciliation | **Complete** — branch reconciled, contracts recorded, legacy changes removed, and CI passed |
| 3.2 — Storage hardening | **Complete** — symlink-safe reads, production-root validation, file-size consistency and range-edge tests; CI run 447372 passed |
| 3.3 — Secure ingestion | **Complete** — configurable limits, admin status/limits endpoints, abort cleanup and UI integration; CI run 447378 passed |
| 3.4 — First-party delivery | Not started |
| 3.5 — Playback contracts and providers | Not started |
| 3.6 — Frontend playback | Not started |
| 3.7 — Integration/security verification | Not started |
| 3.8 — Final audit and freeze | Not started |

Finish each checkpoint, run its tests, inspect the diff and record its audit before starting the next. Do not merge PR #5 or claim Phase 3 complete until all acceptance gates pass.


### Checkpoint 3.1 acceptance — 2026-11-20

- Reconciliation CI run [44735651560](https://github.com/diabolicalG/samren/actions/runs/44735651560) completed successfully.
- The single CI job passed Prisma validation/generation/migrations, seed idempotence, lint, TypeScript typecheck, backend API tests, frontend smoke/accessibility tests and production builds.
- The run did not execute the legacy Python API test step; Phase 3-only legacy Python changes were removed from the branch diff.
- The branch is zero commits behind main and the raw PR API reports `mergeable=true`. PR #5 remains draft/open/unmerged.
- The contracts and readiness/provider audit documents now reflect the read-only reference boundary, Kuhi service restrictions, Anivexa provenance issue, server-owned resource handles, AniList mapping, rate limits and upload configuration.
- **Checkpoint 3.1 accepted.** Proceed to Checkpoint 3.2 only; do not begin later checkpoints until 3.2 is implemented, tested and audited.


### Checkpoint 3.2 acceptance — 2026-11-20

- Implementation commits: `71c046a3b02b494827f787a5ebd4e29b1e6f8c02`, syntax correction `0efdc264f1be280ccb0ac4d9dc06f39f35cde2db`, and production-root/fd-cleanup hardening `6ee0e9314b6efa2a9471d30da490e23122911124`.
- CI run [44737230985](https://github.com/diabolicalG/samren/actions/runs/44737230985) completed successfully: Prisma validation/generation/migrations, seed idempotence, lint, typecheck, backend tests, frontend smoke/accessibility tests and production builds all passed.
- Managed media reads now reject file and shard symlinks, use no-follow file opens, compare actual file size with database metadata, and close handles safely.
- Production requires an explicit absolute storage root and rejects the repository's known public web roots. Deployment-specific static roots must still be checked in deployment configuration.
- Range handling now correctly clamps oversized suffix ranges; tests cover GET/HEAD and malformed/unsatisfiable ranges.
- **Checkpoint 3.2 accepted.** Checkpoint 3.3 is next; do not begin provider/playback work until secure ingestion is implemented and audited.


### Checkpoint 3.3 acceptance — 2026-11-20

- Implementation commits: `100bd608f1e586b9cd0871040ea55113db3afeac`, `59aef045b229b39c9df4e183d2b8aeb06689e81a`, `3ad433c0713bc94050e0f1440bcfb992632a5911` and final UI formatting fix `3172f0dedb96cb4b0aa2cee4177b37ca122758ac`.
- CI run [44737814111](https://github.com/diabolicalG/samren/actions/runs/44737814111) completed successfully. Prisma validation/migrations/seeding, lint, typecheck, backend tests, frontend smoke/accessibility tests and production builds passed.
- Upload limits are validated environment settings, exposed through an ADMIN-only API and loaded by the upload UI. The backend remains authoritative and disables upload when limits cannot be loaded.
- Added ADMIN-only asset status reporting with safe file states and no storage-key/path disclosure.
- Added request timeout configuration and abort/disconnect checks; multipart temporary directories and partial storage writes are cleaned on failure.
- Tests cover authentication, configured limits, PRESENT/NOT_MANAGED/SIZE_MISMATCH status, and the existing signature/size/multipart upload paths.
- **Checkpoint 3.3 accepted.** Proceed to Checkpoint 3.4 — first-party delivery audit and hardening.
