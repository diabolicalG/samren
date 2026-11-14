# Phase 1 — Foundation and Obsidian design system

**Status:** COMPLETE — all Phase 1 CI acceptance checks passed  
**Branch:** `main`  
**Phase 0 baseline:** `ace2559ed8ffb8517b82dd4da710a62b1413c7a4`  
**Final verified implementation checkpoint:** `440c2672ea5921d2195f59593f272ec12f826c3b`  
**Final lockfile synchronization:** `96d504f2a4ff2e81b7182c48d4590a2b56ab65ea`

## Implemented

- Added `apps/frontend`: React 19 + Vite + React Router, TanStack Query provider, initial home/browse routes and responsive Obsidian visual shell.
- Added `apps/backend`: Express + TypeScript runtime scaffold, Helmet security headers, bounded JSON body parsing, credentialed CORS configuration, versioned health route and JSON 404 response.
- Added Zod environment parsing and a PostgreSQL Prisma foundation with User, RefreshToken (hashed token storage) and UserPreferences models. Catalogue models remain deferred to Phase 2.
- Added provider-neutral platform contracts and a typed, credential-aware API client.
- Connected the frontend shell to the typed API client health endpoint. The header reports connected, checking or unavailable based on the real API response; it does not claim a successful connection when the API is offline.
- Added a Vite development proxy from `/api` to the backend on port 4000.
- Added reusable Obsidian design primitives: Button, Card, Surface, TextField, Skeleton, Dialog, ActionLink and StatusBadge. Keyboard focus styling and reduced-motion behavior are included.
- Added frontend Vitest/jsdom smoke and accessibility assertions for home navigation, API status, the honest browse placeholder and semantic design primitives.
- Added backend Vitest/Supertest tests for the health response and consistent JSON 404 envelope.
- Scoped active pnpm workspaces to the new frontend/backend, typed API client, platform types and shared tooling packages. Legacy `packages/hooks`, `packages/ui` and `packages/utils` remain in the repository but are no longer active workspace members or imported by the new runtime.
- Added Oxlint and made linting part of CI for the active foundation source directories.
- Removed the external Google Fonts CSS import. The foundation uses local system font fallbacks.
- Replaced the legacy CI definition with a foundation pipeline for dependency installation, lockfile reconciliation, Prisma validation/generation, lint, typechecking, backend/frontend tests and production builds.
- Kept legacy Next.js, FastAPI and Shivra code physically in place; it is not part of the new runtime and must only be retired after replacement routes and consumers are migrated and checked.

## Current routes and behavior

- Frontend: `/` and `/browse` are initial shell pages. Other paths display an honest not-ready state.
- Backend: `GET /api/v1/health` reports service health; unknown API paths return a typed JSON 404 envelope.
- The frontend health indicator calls the backend through the typed client; the Vite proxy is development-only.
- No catalogue records, third-party anime metadata calls, scraper jobs, stream resolver, external embeds or provider fallback are implemented in the new runtime.

## Final verification

CI run [`43604786828`](https://github.com/diabolicalG/samren/actions/runs/43604786828) for workflow commit `440c2672ea5921d2195f59593f272ec12f826c3b` completed successfully. All steps passed:

1. Dependency installation and lockfile reconciliation.
2. Prisma schema validation.
3. Prisma client generation.
4. Oxlint checks for active foundation source.
5. Frontend and backend TypeScript checks.
6. Backend API tests.
7. Frontend smoke/accessibility and design primitive tests.
8. Frontend and backend production builds.

The CI workflow generated and committed the final lockfile as `96d504f2a4ff2e81b7182c48d4590a2b56ab65ea`. The earlier concurrent lockfile-push race is mitigated by rebasing before the CI lockfile push.

## Phase 1 audit findings and limitations

- The new React/Vite and Express runtimes are separate from the legacy Next.js, FastAPI and Shivra services.
- Legacy packages that contain old anime/provider-oriented hooks and UI have been excluded from the active pnpm workspace. They have not been deleted; their migration/removal must be handled deliberately after replacement verification.
- The CI pipeline validates and generates the Prisma client but does not connect to a live PostgreSQL instance or apply migrations. Database integration and migration testing belong to later phases.
- Redis is not introduced because the Phase 1 foundation has no concrete Redis requirement.
- Frontend tests run in jsdom. They verify semantic roles, labels, navigation and states, but do not replace browser-based visual, device, keyboard-flow or screen-reader testing in the later release audit.
- No authentication endpoints, catalogue records, admin workflows or playback routes are claimed as implemented.
- The historical lockfile/regex failures were corrected and the final current CI run passed; earlier failed runs remain in GitHub Actions history but do not describe the final verified revision.

## Exclusion boundary

The new runtime contains no AniList, Jikan, MAL, TMDB, TVMaze, WCOStream, Shivra, external anime catalogue, third-party stream host, scraper/extractor, provider registry, source-resolution or arbitrary remote-media integration. Legacy source remains physically present and is quarantined from the active workspace pending later migration/removal review.

## Phase decision

**PHASE 1: COMPLETE.** Its implementation, lint, typecheck, Prisma validation/generation, backend tests, frontend tests and production builds have passed in CI.

**PHASE 2 remains untouched and is not started by this audit.**
