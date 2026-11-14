# Phase 1 — Foundation and Obsidian design system

**Status:** In progress — runtime health integration and frontend smoke tests added; latest CI verification pending  
**Branch:** `main`  
**Phase 0 baseline:** `ace2559ed8ffb8517b82dd4da710a62b1413c7a4`

## Implemented

- Added `apps/frontend`: React 19 + Vite + React Router, TanStack Query provider, initial home/browse routes and responsive Obsidian visual shell.
- Added `apps/backend`: Express + TypeScript runtime scaffold, Helmet security headers, bounded JSON body parsing, credentialed CORS configuration, versioned health route and JSON 404 response.
- Added Zod environment parsing and a PostgreSQL Prisma foundation with User, RefreshToken (hashed token storage) and UserPreferences models. Catalogue models remain deferred to Phase 2.
- Added provider-neutral platform contracts and a typed, credential-aware API client.
- Connected the frontend shell to the typed API client health endpoint. The header reports connected, checking or unavailable based on the real API response; it does not claim a successful connection when the API is offline.
- Added a Vite development proxy from `/api` to the backend on port 4000.
- Added reusable Obsidian UI primitives for semantic surfaces, action links and API status badges, with visible keyboard focus styling.
- Added frontend Vitest/jsdom smoke tests for home navigation, the API connection state and the honest not-yet-available browse page.
- Added backend Vitest/Supertest tests for the health response and consistent JSON 404 envelope.
- Added pnpm workspace configuration and aligned root/frontend/backend package manifests with the new runtime.
- Removed the external Google Fonts CSS import. The foundation uses local system font fallbacks.
- Replaced the legacy CI definition with a foundation pipeline for dependency installation, Prisma validation/generation, typechecking, backend/frontend tests and production builds. On pushes to `main`, the pipeline reconciles and commits the pnpm lockfile if dependency manifests have changed.
- Kept legacy Next.js, FastAPI and Shivra code physically in place; it is not part of the new runtime and must only be retired after replacement routes and consumers are migrated and checked.

## Current routes and behavior

- Frontend: `/` and `/browse` are initial shell pages. Other paths display an honest not-ready state.
- Backend: `GET /api/v1/health` reports service health; unknown API paths return a typed JSON 404 envelope.
- The frontend health indicator calls the backend through the typed client; the Vite proxy is development-only.
- No catalogue records, third-party anime metadata calls, scraper jobs, stream resolver, external embeds or provider fallback are implemented.

## Remaining Phase 1 acceptance work

1. Observe a clean CI run after adding frontend test dependencies and the API integration.
2. Fix any lockfile, typecheck, test or production-build failures reported by that run.
3. Expand the Obsidian design system only where the foundation routes require it; do not build unused UI primitives speculatively.
4. Confirm the new runtime remains isolated from the legacy Next.js/FastAPI/Shivra code and from all external anime metadata/media providers.
5. Mark Phase 1 complete only after install, Prisma validation/generation, typecheck, backend tests, frontend smoke tests and production builds all pass in CI.

## Verification and limitations

- CI run `43603989248` for commit `c6028e57ff0004d150c3e62d42f1d90ac34800c0` completed successfully. It passed dependency installation, lockfile reconciliation, Prisma validation/generation, typechecking, backend API tests and frontend/backend production builds.
- That successful run predates the current frontend API integration and frontend smoke tests. The current revision must pass a fresh CI run before these additions are considered verified.
- The CI lockfile reconciliation step generated and committed the updated workspace lockfile as `bfc40894a8eaba1a9c5c99d77462eb04a8993502`. A concurrent contents commit caused an earlier workflow run's lockfile push to be rejected; the workflow now rebases before pushing a generated lockfile to avoid that race.
- The first full frontend typecheck exposed an invalid trailing-slash regular expression in the shared API client. It has been corrected in `5d66c224af76e01995096b9870dbd82be2472001`; a fresh CI run is required to verify the fix and the frontend tests.
- No local install, test run or build is claimed here. Phase 1 is not complete until the current CI run passes.

## Exclusion gate

Do not add AniList, Jikan, MAL, TMDB, TVMaze, WCOStream, Shivra, external anime catalogues, third-party stream hosts, scraper/extractor code, provider registries, source resolution or arbitrary remote media URLs to the new runtime.
