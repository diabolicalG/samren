# Samren Phase 2 — Progress

**Status:** IN PROGRESS — public catalogue and authenticated anime administration implemented and CI-verified  
**Branch:** `main`  
**Scope checkpoint:** [`910bc5f`](https://github.com/diabolicalG/samren/commit/910bc5fdce840bf9fb67d6afd7b1e4403a9578d6)  
**Phase 1 final checkpoint:** [`fa471ba`](https://github.com/diabolicalG/samren/commit/fa471ba986bdd462d20d17e0f002218b540567f8)

## Implemented so far

- Added normalized Prisma catalogue models for anime, genres, studios, join relations, seasons, episodes, application-owned media metadata, episode media associations and subtitle metadata.
- Added PostgreSQL migration `20261114153000_catalogue_foundation`.
- Added deterministic local seed fixtures for three sample catalogue entries, genres, one season and a sample studio. Upserts do not overwrite existing records.
- Added shared catalogue API contracts and typed API client methods.
- Added public read endpoints for paginated/filterable anime, anime detail, episodes, genres, studios and seasons.
- Public queries are restricted to `PUBLISHED` catalogue records. Media responses select safe metadata only and never return storage keys.
- Added home featured/recent sections, browse filters (search, format, release status, genre, studio, year), sorting and pagination, and anime detail/episode listing.
- Added scrypt password hashing, opaque server-side sessions stored as token hashes, 12-hour HttpOnly/SameSite cookies, trusted-Origin checks, and per-process failed-login throttling.
- Added a one-time administrator bootstrap command. It refuses to elevate existing non-admin accounts or overwrite an existing administrator.
- Added role-protected admin anime listing, draft creation, metadata updates, publish/unpublish and soft-archive routes; mutations require an exact trusted Origin.
- Added the responsive `/admin` sign-in and catalogue workspace. It exposes create, publish/unpublish and archive actions only to a verified ADMIN session.
- Updated CI to start PostgreSQL, apply migrations and seed fixtures before running checks.

## Explicitly deferred / not complete

- Admin taxonomy management (genres, studios, seasons), episode CRUD, and media-asset metadata management remain to be implemented.
- The current admin UI creates anime drafts and publishes/unpublishes/archives records; richer metadata editing and taxonomy/episode screens remain outstanding.
- Actual media uploads, storage delivery and player integration belong to later phases. Phase 2 stores metadata only and does not resolve or expose arbitrary media URLs.
- The initial administrator must be provisioned manually using the documented one-time bootstrap command. There is no public registration or password-reset flow.
- Failed-login throttling is per API process; multi-instance production deployments should also enforce shared edge/reverse-proxy rate limiting.
- Live production database deployment, backup/restore and storage lifecycle are not claimed.
- Search currently uses PostgreSQL case-insensitive title matching plus exact alternate-title matching; full-text ranking can be evaluated separately if needed.

## Verification status

- **PASS:** [CI run 43606858346](https://github.com/diabolicalG/samren/actions/runs/43606858346) on commit [`b25461d`](https://github.com/diabolicalG/samren/commit/b25461d46fb273767c894c9920919c1092b3a72e).
- PostgreSQL 16 service started in CI; Prisma schema validation and client generation passed; the catalogue migration deployed successfully; deterministic fixtures seeded successfully.
- Oxlint, frontend/backend TypeScript checks, backend API/auth/admin tests, frontend smoke/accessibility/admin-state tests, and frontend/backend production builds all passed.
- A frontend test-isolation issue was fixed by explicitly unmounting rendered trees after each test. The final run is green.
- This is CI integration evidence against a disposable PostgreSQL service, not a claim that a production database has been deployed or migrated.

## Boundary check

- No external anime metadata APIs, scrapers, provider integrations, embeds, third-party media fallback or source-resolution code was added to the active runtime.
- Anime-streaming remains read-only.
- Legacy Next.js, FastAPI, Shivra and excluded shared-package code remains physically untouched.
- Phase 3 playback and Phase 4 personal accounts/library have not started.
