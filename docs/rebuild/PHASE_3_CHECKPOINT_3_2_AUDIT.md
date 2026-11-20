# Samren Phase 3 — Checkpoint 3.2 Audit

**Checkpoint:** 3.2 — Storage hardening  
**Date:** 2026-11-20  
**Branch:** `phase-3-media-providers`  
**Implementation commits:** `71c046a`, `0efdc264`, `6ee0e93`  
**CI evidence:** [Run 44737230985](https://github.com/diabolicalG/samren/actions/runs/44737230985)

## 1. Verdict

<badge>ACCEPTED</badge>

Checkpoint 3.2 is complete. The final CI run passed all active-workspace gates. This acceptance covers storage-read safety, production storage-root validation, database/on-disk size consistency and HTTP range edge cases. It does not accept the full Phase 3 scope.

## 2. Changes reviewed

### Filesystem safety

- Managed storage keys remain generated and strictly shaped.
- Storage-root symlinks are rejected.
- Shard-parent symlinks and non-directory parents are rejected.
- Reads use `lstat` and `O_NOFOLLOW` where supported, then verify the opened file descriptor is a regular file.
- The file handle is closed if descriptor verification fails.
- Read/delete lookups no longer create missing shard directories.
- Delete operations reject symlink/non-regular targets.

### Storage configuration

- Development retains the `.data/media` default.
- Production requires an explicit absolute `MEDIA_STORAGE_ROOT`.
- The configured path is rejected if it is inside the repository's known `public`, `apps/frontend/public` or `apps/backend/public` directories.
- The active backend environment example documents the production requirement.

### Public delivery integrity

- Public media delivery selects database `sizeBytes` and compares it with the opened file's actual size.
- Size mismatch, missing file and invalid/empty managed media fail closed.
- Subtitle delivery applies the same database/on-disk size check before reading.
- The route streams from the already-open file handle instead of reopening a path after validation.

### HTTP range handling

- Single-range parsing uses BigInt for range values.
- Oversized suffix ranges clamp to the full file as required.
- Unsatisfiable and malformed ranges return 416 with `Content-Range: bytes */size`.
- GET and HEAD behavior is covered, including HEAD with a partial range.

## 3. Test evidence

The added/updated tests cover:
- Symlinked managed media files.
- Symlinked shard directories.
- Production missing/relative storage-root rejection.
- Production public-root rejection.
- Absolute production storage-root acceptance.
- Database/on-disk size mismatch rejection.
- Oversized suffix-range clamping.
- HEAD and HEAD-range behavior.
- Existing storage write, checksum, cleanup and subtitle conversion behavior.

CI run 44737230985 passed:
- Prisma schema validation and client generation.
- PostgreSQL migration and seed/idempotence.
- Oxlint.
- TypeScript typecheck.
- Backend API tests.
- Frontend smoke/accessibility tests.
- Frontend/backend production builds.

An intermediate commit `05e0b859` had a syntax error in the media route query and failed lint. It was corrected in `0efdc264`; the final audited head `6ee0e93` passed the full CI workflow.

## 4. Residual limitations — not hidden

- This does not verify that the configured production filesystem is actually persistent, backed up or restorable.
- The runtime can reject the repository's known public directories, but deployment-specific static roots must still be checked in deployment configuration.
- SHA-256 is recorded at ingestion but is not recomputed for every public read; current integrity enforcement compares the stored size with the opened file size.
- Upload size limits are still hard-coded.
- The ADMIN asset-status endpoint is still missing.
- Upload request timeout/disconnect behavior and multipart staging cleanup need their own checkpoint.
- Real-browser playback and live provider verification remain outstanding.

These residuals are carried into Checkpoint 3.3 and later release verification; they are not represented as completed.

## 5. Repository boundary

All changes in this checkpoint are in Samren. The Anime-streaming repository was not modified and remains a read-only reference.

**Checkpoint 3.2 is accepted. Proceed to Checkpoint 3.3 — Secure ingestion.**
