# Samren Phase 2 — Progress

**Status:** COMPLETE — implementation and PostgreSQL-backed CI verification passed  
**Branch:** `main`  
**Phase 1 checkpoint:** [`fa471ba`](https://github.com/diabolicalG/samren/commit/fa471ba986bdd462d20d17e0f002218b540567f8)  
**Phase 2 scope:** [PHASE_2_SCOPE.md](./PHASE_2_SCOPE.md)  
**Administrator setup:** [ADMIN_SETUP.md](./ADMIN_SETUP.md)

## Delivered

- Normalized PostgreSQL/Prisma models for anime, genres, studios, join relations, seasons, episodes, media assets, episode video associations and subtitle tracks.
- PostgreSQL migration `20261114153000_catalogue_foundation`; schema validation and Prisma Client generation are part of CI.
- Deterministic, local-only sample fixtures. Seed upserts do not overwrite existing catalogue content; CI runs the seed twice to verify idempotent execution.
- Public API routes for paginated/filterable anime, detail, published episode lists, genres, studios and seasons. Public queries only return published catalogue content.
- Search and browse filters for title, format, release status, year, season, genre, studio, featured and sort order.
- Home featured/recent sections, browse filtering/pagination and anime detail/episode views with loading, error and empty states.
- Server-side administrator authentication: salted scrypt password hashes, cryptographically random opaque session tokens, SHA-256-only token storage, 12-hour HttpOnly/SameSite cookies, logout revocation, no-store auth responses, exact Origin checks and bounded per-process failed-login throttling.
- One-time environment-driven first-admin bootstrap. It refuses to elevate existing non-admin users or overwrite an existing administrator.
- Explicit trusted-proxy hop configuration. The default CORS origin is only the active Vite frontend origin (`http://localhost:5173`).
- ADMIN-protected APIs for anime, genres, studios, seasons, episodes, asset metadata, episode video associations and subtitle tracks. Mutations use Zod validation and exact Origin checks. Referenced taxonomy/assets are validated; in-use taxonomy and assets cannot be deleted.
- Responsive admin workspace for anime draft creation, metadata editing, publish/unpublish/archive, taxonomy creation/edit/delete, episode creation/edit/publish/archive, internal asset metadata registration/edit/delete, and attachment/detachment of video and subtitle metadata.
- Asset metadata validation rejects remote URLs, path traversal and MIME/media-kind mismatches. Public API responses expose safe asset metadata only; storage keys are not returned publicly.
- CI uses a disposable PostgreSQL 16 service to deploy migrations, seed twice, run lint/typechecks, backend integration tests, frontend smoke/accessibility tests and production builds.

## Verification

- The last fully green implementation run before the final CORS tightening was [CI run 43609617230](https://github.com/diabolicalG/samren/actions/runs/43609617230), which passed schema validation, client generation, migrations, seed twice, lint, typecheck, backend tests, frontend tests and both production builds.
- A final CI run is checking the tightened CORS default and matching test origins; update this section with its result before treating this progress document as the final release checkpoint.
- CI evidence is against an ephemeral PostgreSQL service. No production database deployment, backup/restore exercise or production migration has been performed.

## Explicit limitations

- Phase 2 records first-party media metadata only. It does not upload files, verify that storage objects exist, expose public storage delivery, generate artwork URLs or implement a player. Secure first-party media delivery and playback are Phase 3.
- The frontend tests use jsdom and are not a substitute for real-browser visual, device, assistive-technology or end-to-end testing.
- The first administrator is provisioned manually. Public registration, password reset/recovery, MFA, session refresh/rotation and role-management workflows are not included.
- Failed-login throttling is process-local. Multi-instance deployments must add a shared edge/reverse-proxy rate limit before public exposure.
- Search uses PostgreSQL case-insensitive text matching and exact alternate-title matching, not a dedicated full-text search index.
- Redis is not needed for this phase and was not added.

## Boundary verification

- No external anime metadata API, scraper, provider adapter, source resolver, third-party embed, arbitrary remote media URL, stream proxy or third-party fallback was added to the active runtime.
- Sample seed data is authored locally and performs no network calls.
- `Anime-streaming` remains a read-only architecture reference and was not modified.
- Legacy Next.js, FastAPI, Shivra and excluded shared-package source remains physically untouched; only the new scoped workspace is active.
- Phase 3 playback and Phase 4 personal accounts/library have not started.
