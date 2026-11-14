# Phase 1 — Foundation and Obsidian design system

**Status:** In progress — foundation scaffold and CI correction committed; awaiting a clean CI run and remaining acceptance work  
**Branch:** `main`  
**Phase 0 baseline:** `ace2559ed8ffb8517b82dd4da710a62b1413c7a4`

## Implemented

- Added `apps/frontend`: React 19 + Vite + React Router, TanStack Query provider, initial home/browse routes and responsive Obsidian visual shell.
- Added `apps/backend`: Express + TypeScript runtime scaffold, Helmet security headers, bounded JSON body parsing, credentialed CORS configuration, versioned health route and JSON 404 response.
- Added Zod environment parsing and a PostgreSQL Prisma foundation with User, RefreshToken (hashed token storage) and UserPreferences models. Catalogue models remain deferred to Phase 2.
- Added provider-neutral platform contracts and a typed, credential-aware API client.
- Added pnpm workspace configuration and aligned root/frontend/backend package manifests with the new runtime.
- Removed the external Google Fonts CSS import. The foundation uses local system font fallbacks.
- Replaced the legacy CI definition with a foundation pipeline for dependency installation, Prisma validation/generation, typechecking and production builds. On pushes to `main`, the pipeline reconciles and commits the pnpm lockfile if dependency manifests have changed.
- Kept legacy Next.js, FastAPI and Shivra code physically in place; it is not part of the new runtime and must only be retired after replacement routes and consumers are migrated and checked.

## Current routes and behavior

- Frontend: `/` and `/browse` are initial shell pages. Other paths display an honest not-ready state.
- Backend: `GET /api/v1/health` reports service health; unknown API paths return a typed JSON 404 envelope.
- No catalogue records, third-party anime metadata calls, scraper jobs, stream resolver, external embeds or provider fallback are implemented.

## Remaining Phase 1 acceptance work

1. Confirm the updated CI workflow completes dependency installation and commits a synchronized lockfile.
2. Resolve any TypeScript, Prisma or production-build failures surfaced by that run.
3. Add shared Zod request/response contracts and connect the frontend to the typed API client through a development proxy.
4. Build and test reusable Obsidian components (buttons, fields, cards, skeletons, dialogs, navigation and layout primitives).
5. Add focused backend health/envelope tests and frontend smoke/accessibility checks.
6. Run actual install, lint, typecheck, tests and production builds; capture a clean CI result.
7. Keep Redis out until a concrete first-party requirement exists; no queues are needed for this foundation.

## Verification and limitations

- GitHub Actions for commit `9dd6d9c09424bb355ac60dbbe57a4e238b8fa4af` failed at dependency installation because `pnpm-lock.yaml` did not include the new backend package specifiers. Typecheck and build steps were therefore skipped. The legacy Python gateway and Shivra jobs passed, but those jobs are not acceptance evidence for the new runtime.
- Commit `dc852fe5d7ae9aca87e855cfd281e04ce828b575` corrects the CI workflow to reconcile the lockfile and validate/build the new foundation. A successful run for this workflow revision has not yet been observed.
- No local install, test run or build is claimed here. Phase 1 is not complete until the remaining acceptance work passes.

## Exclusion gate

Do not add AniList, Jikan, MAL, TMDB, TVMaze, WCOStream, Shivra, external anime catalogues, third-party stream hosts, scraper/extractor code, provider registries, source resolution or arbitrary remote media URLs to the new runtime.
