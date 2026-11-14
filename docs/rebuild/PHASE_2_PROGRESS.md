# Samren Phase 2 — Progress

**Status:** IN PROGRESS — public catalogue slice implemented and CI-verified  
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
- Added a fail-closed ADMIN role guard with tests. No catalogue write route is exposed without a verified principal.
- Updated CI to start PostgreSQL, apply migrations and seed fixtures before running checks.

## Explicitly deferred / not complete

- Admin catalogue CRUD UI and write endpoints remain gated on a secure authentication/session middleware. No temporary admin token or unauthenticated mutation path will be introduced.
- Actual media uploads, storage delivery and player integration belong to later phases. Phase 2 stores metadata only and does not resolve or expose arbitrary media URLs.
- Live production database deployment, backup/restore and storage lifecycle are not claimed.
- Search currently uses PostgreSQL case-insensitive title matching plus exact alternate-title matching; full-text ranking can be evaluated separately if needed.

## Verification status

- **PASS:** [CI run 43606065978](https://github.com/diabolicalG/samren/actions/runs/43606065978) on commit [`ed750d0`](https://github.com/diabolicalG/samren/commit/ed750d0230dbb87b79fb7de5331fc4f9b29f1265).
- PostgreSQL 16 service started in CI; Prisma schema validation and client generation passed; the catalogue migration deployed successfully; deterministic fixtures seeded successfully.
- Oxlint, frontend/backend TypeScript checks, backend API and role-guard tests, frontend smoke/accessibility tests, and frontend/backend production builds all passed.
- The first frontend CI failures were stale Phase 1 browse assertions and an unused import; these were corrected before the successful run.
- This is CI integration evidence against a disposable PostgreSQL service, not a claim that a production database has been deployed or migrated.

## Boundary check

- No external anime metadata APIs, scrapers, provider integrations, embeds, third-party media fallback or source-resolution code was added to the active runtime.
- Anime-streaming remains read-only.
- Legacy Next.js, FastAPI, Shivra and excluded shared-package code remains physically untouched.
- Phase 3 playback and Phase 4 personal accounts/library have not started.
