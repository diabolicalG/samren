# Samren Recreation — Phase 0 Audit & Architecture Plan

**Status:** Phase 0 audit and architecture proposal  
**Target repository:** `diabolicalG/samren`  
**Target branch:** `main` (user explicitly selected direct work on main)  
**Architectural source of truth:** `diabolicalG/Anime-streaming`  
**Visual direction:** Obsidian — cinematic black, restrained violet, cyan and warm gold  
**Implementation status:** Planning only. No application code, dependencies, schema, or existing runtime files have been changed in this phase.

---

## 1. Mission and non-negotiable boundaries

Recreate Samren as an elegant, complete anime catalogue and streaming application, using the architecture and engineering conventions established in Anime-streaming.

Anime-streaming is the source of truth for engineering patterns. Samren remains the product identity and product-scope reference.

### Explicit exclusions

The recreated application must not contain or depend on:

- AniList, Jikan, MyAnimeList, TMDB, TVMaze, or any other external anime/metadata API.
- External anime streaming sites, stream providers, embed hosts, provider registries, extractors, or provider adapters.
- Scrapers, crawlers, source discovery, provider synchronization, provider mapping, or provider-specific identifiers.
- External stream-resolution endpoints or source-fallback logic.
- Runtime requests to external anime catalogue or streaming services.

These exclusions apply to backend code, frontend code, shared packages, environment variables, CI, Docker, documentation, seed scripts, and tests.

### Allowed application-owned data and media

- Anime catalogue records created by administrators or inserted by deterministic local seed fixtures.
- Application-owned genres, studios, seasons, episode records, synopsis, ratings, artwork metadata and release dates.
- Artwork and video assets uploaded to or served from storage controlled by the application.
- A player that consumes only an application-owned media asset record. No third-party embed or provider URL resolution.
- Local fixture data for development and tests. Fixtures must be clearly labelled as sample data and must not silently call external services.

If no first-party video asset is configured, the watch page must show an intentional unavailable/coming-soon state. It must not fall back to a provider.

---

## 2. Repository audit — Samren baseline

Audited public repository state: `main` at commit `3be80f2c3b4c087e5cb08d278622593f14a615f7` (14 November 2026).

### Existing structure

- `apps/web`: Next.js 15 / React 19 frontend with App Router.
- `apps/admin`: separate Next.js admin application.
- `apps/api`: Python FastAPI gateway, with a legacy TypeScript entrypoint also present.
- `services/shivra-api`: Python scraper/data-source service.
- `packages/ui`, `api-client`, `types`, `hooks`, `utils`: shared TypeScript packages.
- `docker`: separate Dockerfiles and Compose configuration.
- `.github/workflows/ci.yml`: frontend, API and scraper CI jobs.
- `pnpm-workspace.yaml`, `pnpm-lock.yaml`, Turbo configuration.

### Current integration dependencies to remove

The repository currently documents and/or implements:

- A FastAPI media aggregator with AniList, TMDB and TVMaze adapters.
- ShivraAPI with Jikan and WCOStream scraping/data-source code.
- Environment variables for AniList, TMDB, TVMaze and ShivraAPI.
- Anime detail/watch hooks that request stream URLs.
- Provider/source and availability concepts in the unified media model.
- A Python SQLModel authentication/data API alongside the separate media API.

These are incompatible with the requested provider-free, anime-API-free end state and must be retired rather than carried forward.

### Existing product surface worth preserving and improving

- Home, popular, ongoing and completed catalogue pages.
- Anime detail and episode navigation.
- Search and genre browsing.
- Seasonal/release schedule experience.
- Watch page and player settings.
- History, favourites, downloads, profile and settings.
- Admin dashboard and catalogue management.
- Shared UI, types, API client and query hooks.

### Audit risks and inconsistencies

1. `AGENTS.md` describes a Prisma schema, but the current tracked tree does not contain a `prisma/` directory or schema. The actual Python gateway defines SQLModel tables inline.
2. The root workspace uses pnpm/Turbo, while Anime-streaming uses npm workspaces. The migration must choose one package-manager/CI contract and update lockfiles and docs consistently.
3. The API contains both `apps/api/src/index.ts` and Python FastAPI entrypoints. The runtime boundary is ambiguous.
4. Frontend types describe Jikan-transformed payloads and source fields, while the unified media API uses a different normalized model. This creates contract drift.
5. User-scoped calls are documented in the API client as requiring authentication, while its comments state that the frontend has no complete login UI. This must be verified and resolved in the implementation audit.
6. The current home page is a thin API-fed grid rather than a complete curated cinematic home experience.
7. The anime detail page currently resolves stream URLs as part of loading the detail experience. The new design must separate catalogue metadata from optional first-party media assets.

---

## 3. Architectural source of truth — Anime-streaming

Adopt these proven patterns from Anime-streaming:

- TypeScript monorepo and explicit workspace scripts.
- React frontend with Vite, React Router, TanStack Query and Zustand.
- Express + TypeScript API with controllers, routes, services and middleware.
- Prisma + PostgreSQL as the persistent source of truth.
- Redis for bounded caching and operational coordination where justified.
- Zod request/environment validation.
- JWT authentication using secure HttpOnly cookies and refresh-token rotation.
- Role-based authorization for user, moderator and administrator actions.
- Structured logging, centralized errors, health endpoints and rate limiting.
- Vitest tests and explicit build, lint, typecheck and database scripts.
- Docker/CI reproducibility after local application checks pass.

### Patterns that must NOT be copied from Anime-streaming

Anime-streaming's discovery and streaming infrastructure is designed around external services. Do not port:

- AniList integration or AniList-specific canonical IDs.
- Provider adapters, provider registry, stream resolver or external stream proxy.
- Consumet, Anivexa, Kuhi, Miruro, AniKoto or other provider clients.
- Provider mappings, provider episode IDs or discovered-release lifecycle.
- Provider discovery/sync schedulers, workers, queues or provider health monitors.
- Any external anime API environment variables or integration tests.

The user/account patterns in Anime-streaming's Prisma schema are reusable starting points, but the catalogue schema must be redesigned around application-owned records.

---

## 4. Proposed target architecture

### Runtime layout

Recommended application shape:

- `apps/frontend`: one React 19 + Vite SPA, including public pages and a protected `/admin` area.
- `apps/backend`: one Express + TypeScript API.
- `apps/backend/prisma`: Prisma schema, migrations and deterministic seed fixtures.
- `packages/types`: shared API/domain contracts.
- `packages/api-client`: typed same-origin API client.
- `packages/hooks`: TanStack Query hooks and mutations.
- `packages/ui`: shared accessible design-system components.
- `packages/utils`: formatting, validation and shared utilities.
- `docs`: architecture, API, operations, security and user documentation.
- `docker`: application, PostgreSQL and Redis development/production configuration.

The public site and admin console should share one design system, API client, auth state and domain types. Admin routes must be protected in both the UI and API; hiding a navigation link is not authorization.

### Request flow

Browser (React/Vite)
→ typed API client / TanStack Query
→ Express routes
→ validation + authentication/authorization middleware
→ controllers
→ domain services
→ Prisma
→ PostgreSQL

Redis is optional infrastructure for cache/rate-limit/short-lived coordination. PostgreSQL remains authoritative. No scraper, anime API, provider or source-resolution service exists in this request flow.

### Domain model proposal

Use application-generated IDs. Do not require AniList/MAL/provider IDs.

- `User`: username, email, password hash, role, verification and timestamps.
- `RefreshToken`: hashed token material, expiry, revocation and user relation.
- `Anime`: internal ID, titles, synopsis, status, type, year, season, score, age rating, cover asset, banner asset, featured flag, publication state and timestamps.
- `Genre`, `Studio`, `AnimeGenre`, `AnimeStudio`: normalized catalogue taxonomy and relations.
- `Season`: application-managed seasonal grouping and release metadata where needed.
- `Episode`: internal ID, anime relation, season/episode numbers, title, synopsis, duration, air date, filler/recap flags and publication state.
- `MediaAsset`: application-owned storage key/path, media type, MIME type, size, checksum, processing state and metadata.
- `EpisodeMedia`: relation from an episode to an application-owned video asset.
- `SubtitleTrack`: application-owned subtitle asset, language, label, format and default flag.
- `WatchlistItem`: unique user/anime relation, status, score and progress.
- `WatchHistory`: user/anime/episode relation, playback position, duration, completion and last-watched time.
- `UserPreferences`: theme, autoplay, auto-next, subtitle preference and player defaults.
- `DownloadRecord`: only if first-party downloadable assets are supported; track application-owned asset downloads, not provider scraping.
- `AuditLog`: administrator actions and sensitive catalogue/account changes.

Use relational tables and foreign keys for catalogue relationships. Avoid JSON blobs for core identity/relations. Add indexes for public catalogue filters, episode ordering, user library queries and history ordering.

### Media boundary

The player accepts an application-owned `MediaAsset` reference resolved by the backend. The backend returns a safe same-origin asset URL or an authorized first-party delivery URL. Do not accept arbitrary user-supplied remote URLs, iframe embeds or arbitrary proxy targets. Upload and delivery security, MIME validation, file-size limits, access control and path traversal protection are mandatory.

---

## 5. Obsidian visual system

### Design principles

- Cinematic, editorial and premium; not visually noisy.
- Dark surfaces with deliberate depth and restrained glass effects.
- Strong hierarchy: one hero focus, clear section titles and consistent card rhythm.
- High-quality poster crops and backdrops from application-owned assets.
- Responsive-first layouts, accessible contrast, keyboard support and reduced-motion support.
- Real skeleton, empty, error and unavailable states; no fake loading forever.

### Tokens

- Background: `#080A0F` / `#0D1117`.
- Elevated surfaces: `#121722` and `#171E2B`.
- Primary accent: violet `#8B5CF6`.
- Secondary accent: cyan `#22D3EE`.
- Highlight: warm gold `#F5C518`.
- Primary text: `#F4F6FA`; muted text: `#98A2B3`.
- Typography: Inter for interface; optional display face for hero/section titles, loaded locally or bundled to avoid runtime font API calls.
- Motion: short, purposeful transitions; respect `prefers-reduced-motion`.

### Core experiences

1. Home: cinematic featured hero, continue watching, trending/popular editorial rails, recently added, seasonal collection and curated categories.
2. Browse: sortable/filterable catalogue, genre chips, status/type/year filters and pagination.
3. Search: debounced local API search, clear empty states, keyboard-accessible results.
4. Anime detail: artwork, metadata, synopsis, genres, studios, season, episode list, watchlist actions and available first-party media status.
5. Watch: responsive player shell, episode rail, previous/next navigation, playback progress, subtitles and quality only when supported by the stored asset.
6. Library: continue watching, watching/planned/completed/on-hold/dropped lists, favourites and history.
7. Account: profile, preferences, sessions and privacy controls.
8. Admin: catalogue CRUD, genre/studio management, episode management, artwork/media upload, featured collections, user/role management and audit log.

---

## 6. API surface proposal

All endpoints are versioned under `/api/v1`. Exact payloads are to be finalized with shared Zod schemas before implementation.

### Public catalogue

- `GET /catalog/anime`
- `GET /catalog/anime/:animeId`
- `GET /catalog/anime/:animeId/episodes`
- `GET /catalog/genres`
- `GET /catalog/studios`
- `GET /catalog/seasons`
- `GET /catalog/search`
- `GET /catalog/collections/featured`

### Authentication and user library

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `GET /auth/me`
- `GET/POST/PATCH/DELETE /users/me/watchlist`
- `GET/POST/PATCH /users/me/history`
- `GET/PATCH /users/me/preferences`
- `GET/PATCH /users/me/profile`

### First-party playback

- `GET /episodes/:episodeId/playback` returns availability only for an attached application-owned asset.
- `POST /episodes/:episodeId/progress` persists progress.
- `GET /media/:assetId` performs authorization and safe first-party media delivery or redirect to configured application storage.

No `/providers`, `/sources`, `/resolve`, scraper, external metadata proxy or third-party API passthrough routes.

### Administration

- `/admin/anime`, `/admin/episodes`, `/admin/genres`, `/admin/studios`, `/admin/assets`, `/admin/collections`, `/admin/users`, `/admin/audit-logs`.
- Every mutation requires server-side role authorization, validation and audit logging.

---

## 7. Migration and removal inventory

The implementation phase must inventory and then remove/replace these Samren areas:

- `services/shivra-api/**`: retire scraper service and all scraper Docker/CI references.
- `apps/api/src/media_api/adapters/**`: retire external metadata adapters.
- `apps/api/src/media_api/services/aggregator.py`: replace with application-owned catalogue services.
- `apps/api/src/media_api/routers/**`: replace external-media endpoints with internal catalogue endpoints.
- `apps/api/src/main.py`: retire SQLModel/FastAPI gateway after the Express API is ready and verified.
- `apps/api/src/index.ts`: assess and replace/remove ambiguous legacy entrypoint.
- `apps/web/**`: recreate public application in the chosen React/Vite architecture, retaining product routes and improving UX.
- `apps/admin/**`: consolidate admin experience into the protected frontend admin area unless implementation audit identifies a compelling reason to keep a separate deployment.
- `packages/types/**`: remove external source/provider/availability fields and define application-owned domain types.
- `packages/api-client/**`, `packages/hooks/**`: remove provider/stream resolver calls and implement typed first-party API calls.
- `packages/ui/**`: preserve useful reusable UI concepts, then restyle and test them under Obsidian.
- `.env.example`, Dockerfiles, Compose, CI, README and docs: remove provider/API credentials, service URLs and scraper jobs.

Do not delete the current implementation in one blind operation. First capture the baseline, map every route and consumer, then replace vertical slices with tests. Remove obsolete code only after the replacement is working and references are gone.

---

## 8. Phased implementation plan after Phase 0

### Phase 1 — Foundation and design system
- Normalize monorepo/package manager and scripts.
- Establish frontend/backend TypeScript configs and shared contracts.
- Build Obsidian tokens, layout shell, navigation, buttons, forms, cards, skeletons, dialogs and responsive primitives.
- Establish Express middleware, health endpoint, Prisma/PostgreSQL and Redis configuration.
- Add CI for install, lint, typecheck, tests and builds.

### Phase 2 — Application-owned catalogue
- Implement normalized Prisma catalogue schema and migrations.
- Add deterministic local seed fixtures.
- Build admin catalogue CRUD and asset metadata management.
- Implement public home, browse, search, genres, seasons and schedule using only PostgreSQL data.
- Verify zero external anime API requests.

### Phase 3 — Anime detail and first-party watch experience
- Build detail pages, season/episode lists and watch route.
- Implement first-party MediaAsset association and secure media delivery contract.
- Integrate Video.js/HLS.js only for application-owned media assets.
- Implement playback progress, subtitles and next/previous episode UX.
- Confirm unavailable state when no first-party media exists.

### Phase 4 — Accounts and personal library
- Registration/login/logout/refresh with secure HttpOnly cookies.
- Profile, watchlist statuses, favourites, history, continue watching and preferences.
- Server-side authorization and session revocation.
- Mobile and accessibility polish.

### Phase 5 — Admin, operations and product completeness
- Admin dashboard, users/roles, audit log, collections and catalogue maintenance.
- Upload validation and storage lifecycle.
- Operational logs, health checks, rate limits, backup/restore documentation.
- Complete help/FAQ and settings experience.

### Phase 6 — Full audit and release hardening
- Unit, integration, API contract and browser E2E tests.
- PostgreSQL migrations and Redis integration checks.
- Security review (auth, authorization, CSRF, XSS, uploads, path traversal, rate limiting, secrets).
- Performance, responsive, accessibility and error-state audits.
- Docker/CI deployment verification.
- Static scan to prove no external anime API, scraper or streaming provider code/config remains.

---

## 9. Acceptance gates

Phase 0 is complete when the user approves this architecture and the exclusion boundary.

Before any phase is marked complete:

- Build, lint and typecheck pass for affected workspaces.
- Relevant tests pass; no test is silently skipped to claim success.
- No secrets or real credentials are committed.
- API contracts and migrations are reviewed.
- No external anime API/provider/scraper dependency is introduced.
- Public catalogue pages work from PostgreSQL/local seed data with external network access disabled.
- Admin endpoints reject unauthorized users even if called directly.
- Player reports unavailable when no first-party media asset exists; it never fabricates a working stream.
- Mobile layouts and accessibility basics are checked.
- A commit checkpoint is created with a clear scope-specific message.

### Global exclusion scan

Search source, configuration, lockfiles, CI, Docker and documentation for terms and endpoints associated with AniList, Jikan, MAL, TMDB, TVMaze, WCOStream, Shivra, provider adapters, extractors, scraper, source resolver, embed hosts and provider-specific environment variables. Review matches manually; documentation may mention exclusions, but runtime code/config must not retain integrations.

---

## 10. Risks and decisions

| Risk | Mitigation |
|---|---|
| No external catalogue API means no automatic catalogue population | Admin-managed catalogue and deterministic local seed fixtures |
| No streaming providers means no third-party stream availability | First-party media assets only; clear unavailable state |
| Current Samren contracts disagree across frontend/API | Define shared TypeScript + Zod contracts before vertical implementation |
| Legacy Python and TypeScript entrypoints overlap | Replace with one Express runtime and remove obsolete service after parity |
| No tracked Prisma schema despite documentation | Create new schema/migrations from the agreed application-owned domain |
| Large redesign on `main` | Small commits, baseline capture, no blind deletion, build/test gate per phase |
| Artwork/font remote dependencies could violate offline/self-owned goals | Bundle fonts and use app-owned artwork/assets; no runtime metadata fetch |

### Decision register

- **Repository:** `diabolicalG/samren`.
- **Branch:** `main`, as explicitly requested. All future direct commits to main should be small and verified.
- **Engineering source of truth:** Anime-streaming patterns, adapted to a provider-free domain.
- **Frontend target:** React 19 + Vite + React Router + TanStack Query + Zustand.
- **Backend target:** Express + TypeScript.
- **Persistence:** Prisma + PostgreSQL.
- **Cache/coordination:** Redis only where justified; no provider/scraper queues.
- **Visual identity:** Obsidian.
- **Catalogue authority:** Samren's own PostgreSQL database and admin-managed content.
- **Media authority:** application-owned uploaded/self-hosted assets only.
- **Excluded:** all external anime APIs, scrapers, streaming providers, provider mapping and stream resolution.
- **Current phase:** audit and architecture proposal only; implementation has not started.

---

## 11. Phase 0 audit conclusion

Samren has a useful product route inventory and shared UI/type/client package layout, but its current data and playback experience is tightly coupled to external anime metadata and scraping services. Its backend also has competing Python/TypeScript entrypoints and an absent tracked Prisma schema despite its development rules describing one.

Anime-streaming provides a stronger target engineering baseline: typed React frontend, Express services, Prisma/PostgreSQL, Redis, secure authentication patterns, modular routing and automated tests. Its provider-centric catalogue and streaming domain must be deliberately excluded.

The recommended rebuild is therefore a clean application-owned catalogue and media platform, not a port of either repository's external integration layer. Preserve Samren's product scope, replace its runtime architecture, and use Anime-streaming's engineering conventions.

**Phase 0 status: AUDIT AND PLAN PREPARED — AWAITING USER APPROVAL BEFORE PHASE 1 IMPLEMENTATION.**
