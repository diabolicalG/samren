# Samren Phase 3 — Checkpoint 3.3 Audit

**Checkpoint:** 3.3 — Secure ingestion  
**Date:** 2026-11-20  
**Branch:** `phase-3-media-providers`  
**Final implementation head:** `3172f0dedb96cb4b0aa2cee4177b37ca122758ac`  
**CI evidence:** [Run 44737814111](https://github.com/diabolicalG/samren/actions/runs/44737814111)

## 1. Verdict

<badge>ACCEPTED</badge>

Checkpoint 3.3 is complete. The final CI run passed all active-workspace gates. This checkpoint covers secure upload ingestion, configurable limits, administrator asset diagnostics and the upload UI's use of server-provided limits.

## 2. Changes reviewed

### Configurable upload limits

Validated environment settings now define:
- Images: 15 MiB default, configurable up to 100 MiB.
- Video: 2 GiB default and maximum.
- Subtitles: 2 MiB default, configurable up to 10 MiB.
- Upload request timeout: 15 minutes default, configurable between 1 and 60 minutes.

The active backend environment example documents these settings. Invalid values fail environment parsing.

### Administrator upload-limits endpoint

- `GET /api/v1/admin/catalog/assets/upload-limits` is protected by the existing ADMIN session middleware.
- It returns per-kind limits from the backend's validated runtime configuration.
- The frontend no longer assumes fixed limits. It fetches the API values, displays the current maximum, rejects oversize selections before submission and disables upload if the limits cannot be loaded.
- The backend continues to enforce limits independently; frontend preflight is not treated as a security boundary.

### Asset status endpoint

- `GET /api/v1/admin/catalog/assets/:assetId/status` is ADMIN-only.
- It reports processing state, safe media metadata and one of: `PRESENT`, `MISSING`, `SIZE_MISMATCH`, `NOT_MANAGED` or `UNAVAILABLE`.
- It does not expose the storage key, absolute path or internal filesystem error.
- Tests cover a valid uploaded file, database/file size mismatch, metadata-only legacy asset and unauthenticated access.

### Upload failure and timeout handling

- Node request timeout is configured from `MEDIA_UPLOAD_TIMEOUT_MS`; header timeout remains bounded.
- Multipart parsing rejects aborted requests and removes its temporary directory on parse failure.
- Raw stream ingestion uses the existing pipeline-based storage writer, which removes partial temporary files when the stream fails or exceeds its limit.
- The route checks request-aborted/response-destroyed state before finalizing an asset.
- Failure cleanup deletes any managed partial file and marks a still-pending database asset as FAILED.
- The route avoids trying to write a JSON error response to a destroyed response.

## 3. Test evidence

The final CI run passed:
- Prisma validation/client generation and PostgreSQL migration.
- Deterministic seed and idempotence.
- Lint and TypeScript typecheck.
- Backend API integration tests.
- Frontend smoke/accessibility tests.
- Frontend/backend production builds.

Specific tests cover upload-limit environment overrides, ADMIN-only limits/status access, status values for present/legacy/mismatched files, signature mismatch, bounded raw and multipart upload paths, and existing partial-stream cleanup.

## 4. Residual limitations

- No per-client upload rate limiting yet.
- Node request timeout applies server-wide, not only to upload routes.
- No malware scanner, deep media parser or codec probe.
- Browser disconnect behavior has not yet been verified in a real-browser E2E test.
- Asset status verifies existence and byte size; it does not recompute SHA-256 on every status/read.
- Production disk persistence, backups and restore remain operational tasks.

These limitations are not represented as completed and remain in the Phase 3 release checklist.

## 5. Repository boundary

All changes are in Samren. `diabolicalG/Anime-streaming` remains read-only and unchanged.

**Checkpoint 3.3 is accepted. Proceed to Checkpoint 3.4 — first-party delivery audit and hardening.**
