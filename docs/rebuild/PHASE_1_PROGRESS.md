# Phase 1 — Foundation and Obsidian design system

**Status:** In progress — initial scaffold checkpoint committed  
**Branch:** `main`  
**Phase 0 baseline:** `ace2559ed8ffb8517b82dd4da710a62b1413c7a4`

## Implemented in this checkpoint

- Added `apps/frontend`: React 19 + Vite + React Router, TanStack Query provider, initial home/browse routes and responsive Obsidian visual shell.
- Added `apps/backend`: Express + TypeScript runtime scaffold, Helmet security headers, bounded JSON body parsing, credentialed CORS configuration, versioned health route and JSON 404 response.
- Added provider-neutral platform contracts to `@samren/types`.
- Updated root scripts to target the new frontend/backend runtime.
- Removed the external Google Fonts CSS import. The foundation currently uses local system fallbacks; a bundled font can be added later without runtime font requests.
- Kept the legacy Next.js, FastAPI and Shivra code in place for now. It will be retired only after replacement routes and consumers have been migrated and checked.

## Current routes and behavior

- Frontend: `/` and `/browse` are initial shell pages. Other paths display an honest not-ready state.
- Backend: `GET /api/v1/health` reports service health.
- No catalogue records, third-party anime metadata calls, scraper jobs, stream resolver, external embeds or provider fallback are implemented.

## Remaining Phase 1 work

1. Regenerate and verify `pnpm-lock.yaml` against the new workspace manifests.
2. Align CI to install/build/typecheck the new workspaces; the existing CI still validates legacy Next.js and Python jobs.
3. Add shared Zod request/response contracts and typed API client configuration.
4. Add Prisma/PostgreSQL configuration and initial connection boundary; the catalogue schema and migrations belong to Phase 2.
5. Define Redis use only when a concrete first-party requirement exists; do not add queues by default.
6. Build reusable Obsidian components (buttons, fields, cards, skeletons, dialogs, navigation and layout primitives).
7. Run actual install, lint, typecheck, tests and production builds; capture the CI result.

## Verification and limitations

The GitHub contents commits confirm that the scaffold files exist on `main`. A local dependency install, TypeScript check, test run or production build has **not** been executed in this environment. The lockfile has not been regenerated yet, so Phase 1 is not complete and the current scaffold must not be treated as release-ready.

## Exclusion gate

Do not add AniList, Jikan, MAL, TMDB, TVMaze, WCOStream, Shivra, external anime catalogues, third-party stream hosts, scraper/extractor code, provider registries, source resolution or arbitrary remote media URLs to the new runtime.
