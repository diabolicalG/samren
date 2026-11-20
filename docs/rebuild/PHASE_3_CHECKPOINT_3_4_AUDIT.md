# Samren Phase 3 — Checkpoint 3.4 Audit

**Checkpoint:** 3.4 — First-party asset delivery  
**Date:** 2026-11-20  
**Implementation head:** 4986091f1c90a6ca0698d14f95d48048f011dd63  
**CI evidence:** [Run 44738805397](https://github.com/diabolicalG/samren/actions/runs/44738805397)

## 1. Verdict

<badge>ACCEPTED</badge>

Checkpoint 3.4 is accepted. The final CI run passed the full active-workspace workflow.

## 2. Delivery controls reviewed

- Public media lookup requires a READY asset attached to published content.
- The association must match the asset's media kind: POSTER, BANNER, VIDEO or SUBTITLE.
- MIME allowlists are enforced in the public lookup, not only in the admin upload path.
- The generic media route serves published poster/banner images, supported video files and VTT subtitle assets.
- SRT subtitle assets are delivered through the explicit WebVTT conversion route.
- The storage service opens a managed file safely and the route verifies the opened file size against database metadata before responding.
- Internal storage keys and absolute filesystem paths are never returned.
- Safe response headers include Content-Type, Content-Length, Accept-Ranges and X-Content-Type-Options; checksum-backed ETags are emitted.
- GET and HEAD are supported.
- Single byte ranges support normal, open-ended and suffix requests. Invalid/unsatisfiable ranges return 416 with Content-Range. Multi-range requests are intentionally unsupported.
- Missing, unavailable, unpublished, wrong-kind, wrong-MIME and size-mismatched assets fail closed.

## 3. Tests and evidence

The delivery tests cover:
- Published video delivery and the media-kind/MIME/publication query.
- Published poster delivery.
- Direct VTT delivery and SRT-to-WebVTT conversion.
- GET and HEAD, including HEAD with a range.
- Partial responses, suffix ranges and end clamping.
- Malformed and unsatisfiable ranges.
- Unpublished/missing assets.
- Database/on-disk size mismatch.
- Malformed subtitle handling.

CI run 44738805397 passed:
- Prisma validation/client generation and PostgreSQL migrations/seeding.
- Lint and TypeScript typecheck.
- Backend integration tests.
- Frontend smoke/accessibility tests.
- Frontend/backend production builds.

## 4. Remaining limitations

- No production-scale concurrent delivery or load certification has been performed.
- No CDN or object storage is included; this checkpoint uses the approved local managed filesystem.
- Conditional 304 handling and multi-range delivery are not implemented; neither is required by the current approved scope.
- Real-browser playback, seeking and cross-browser codec compatibility remain for the frontend/integration checkpoints.
- The active React/Vite app still has no watch route/player; this is not a Checkpoint 3.4 acceptance criterion.

## 5. Repository boundary

Only Samren was changed. Anime-streaming remains read-only and unchanged.

**Checkpoint 3.4 accepted.**
