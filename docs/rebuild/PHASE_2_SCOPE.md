# Samren Phase 2 — Application-Owned Catalogue

**Status:** IN PROGRESS — public catalogue and authenticated anime admin slice implemented; taxonomy, episode and asset administration remain outstanding  
**Repository:** `diabolicalG/samren`  
**Branch:** `main`  
**Phase 1 baseline:** `fa471ba986bdd462d20d17e0f002218b540567f8`  
**Architecture source:** `diabolicalG/Anime-streaming` (READ ONLY)

## 1. Objective

Deliver a working catalogue backed exclusively by Samren's PostgreSQL database. Administrators must be able to create and maintain anime, genres, studios, seasons, episodes, and application-owned media metadata. Public users must be able to browse, filter, search, and view catalogue records through the React application.

The catalogue is authoritative only when stored in Samren. No external service is used to populate, enrich, search, map, synchronize, or resolve catalogue data.

## 2. Hard boundaries

- Anime-streaming is an architecture reference only and must not be modified.
- Do not add AniList, Jikan, MAL, TMDB, TVMaze, Consumet, Anivexa, Kuhi, Miruro, AniKoto, WCOStream, Shivra, or any other external anime metadata/media integration.
- No scraping, crawling, provider adapters, provider identifiers, source resolution, third-party embeds, arbitrary remote media URLs, or stream proxy/fallback logic.
- Seed data must be deterministic, local, clearly labelled as sample fixtures, and must never call a network service.
- Never delete legacy Next.js, FastAPI, Shivra, or shared-package source as part of this phase. Keep the active runtime isolated.
- PostgreSQL is the source of truth. Redis is not required for this phase.
- No Docker requirement for development. CI must validate schema, generate Prisma Client, run tests and build.
- Do not claim live database/migration verification unless a real PostgreSQL service was actually used.

## 3. Catalogue domain

Implement normalized relational models using application-generated IDs:

- **Anime:** internal ID, unique slug, primary and alternate titles, synopsis, type, publication status, release status, year/season, age rating, optional score, featured flag, poster/banner asset relations, created/updated timestamps.
- **Genre:** unique slug and display name.
- **Studio:** unique slug, display name, optional description and official website text (not a fetched URL).
- **AnimeGenre / AnimeStudio:** explicit many-to-many join models with unique constraints and cascade-safe relations.
- **Season:** application-managed year/season grouping with unique year+season identity.
- **Episode:** anime relation, optional season relation, episode number, optional absolute number, title, synopsis, duration, air date, publication status, recap/filler flags and timestamps.
- **MediaAsset:** application-owned asset metadata only: storage key, original filename, media kind, MIME type, byte size, checksum, processing state and timestamps. No arbitrary remote URL field.
- **Anime poster/banner and EpisodeMedia / SubtitleTrack relations:** connect catalogue records to application-owned asset metadata. Playback and delivery are Phase 3; no player or stream URL resolution is added in Phase 2.

Use enums for bounded status/type fields, foreign keys for relations, unique constraints for slugs and episode identity, and indexes for common public filters, title search, featured ordering and episode ordering. Avoid JSON blobs for core identity and relations.

## 4. API and validation

All routes are under `/api/v1`.

Public read routes:
- `GET /catalog/anime` — paginated list with validated search, type, status, year, season, genre, studio and featured filters; deterministic sorting.
- `GET /catalog/anime/:slug` — published anime detail with genres, studios and asset metadata safe for display.
- `GET /catalog/anime/:slug/episodes` — published episodes in stable episode order.
- `GET /catalog/genres`
- `GET /catalog/studios`
- `GET /catalog/seasons`
- `GET /catalog/search` may be implemented as an alias/optimized search route only if it adds value beyond list search.

Admin write routes:
- CRUD for anime, genres, studios, seasons, episodes, and media asset metadata.
- All mutation schemas use Zod; IDs and slugs are validated; database uniqueness and foreign-key failures map to consistent API errors.
- Mutations must fail closed unless an authenticated principal with ADMIN role is present. Do not ship an unauthenticated write endpoint or a hard-coded admin token. If the existing runtime lacks authentication, implement only the reusable role guard and keep HTTP writes disabled until a secure admin identity/session path is available; record this dependency rather than bypassing authorization.

## 5. Frontend scope

- Replace the Phase 1 Browse placeholder with database-backed catalogue browsing.
- Home shows published featured and recently added catalogue records, with explicit empty states when no records exist.
- Browse supports search, genre/status/type/year filters, pagination, loading/error/empty states and responsive layouts.
- Add catalogue detail route with synopsis, metadata, genre/studio links and episode listing.
- Add an admin catalogue workspace; the authenticated anime management screen is implemented. Taxonomy, episode and asset metadata screens remain outstanding.
- Keep the Obsidian visual language, accessible controls, keyboard navigation and reduced-motion behavior.
- Artwork is displayed only from safe application-owned asset references. No hotlinked external anime artwork.

## 6. Seed and database workflow

- Add deterministic seed fixtures for development/test, clearly marked sample content.
- Seed must be idempotent and must not overwrite administrator-edited catalogue content.
- Add Prisma migration files and scripts.
- Validate schema and generate Prisma Client in CI.
- Add repository/service/API tests for filtering, pagination, publication visibility, relations, CRUD validation, not-found and conflict cases.
- Use an ephemeral PostgreSQL service in CI for migration and database integration tests if the workflow supports it; otherwise state precisely which checks are schema-only.

## 7. Delivery sequence

1. Review active Phase 1 contracts and define shared catalogue types/Zod schemas.
2. Add normalized Prisma schema and migration; validate/generate client.
3. Add Prisma client lifecycle and catalogue repository/service layer.
4. Add public catalogue endpoints and integration tests.
5. Add deterministic seed fixtures and verify idempotence.
6. Add frontend data hooks/client methods and home/browse/detail experiences.
7. Add admin mutation endpoints/UI behind verified server-side ADMIN sessions. Anime management is implemented; complete taxonomy, episode and asset metadata management.
8. Run lint, typecheck, tests, schema/migration checks and production builds; audit runtime/config/lockfiles for excluded integrations.
9. Publish Phase 2 progress and final audit; create a commit checkpoint only after acceptance gates pass.

## 8. Acceptance gates

- [ ] Normalized Prisma catalogue schema validates and client generation succeeds.
- [ ] Migration is created and tested against PostgreSQL, or the exact limitation is documented.
- [ ] Seed fixtures are deterministic, local-only and idempotent.
- [ ] Public catalogue API returns only PUBLISHED records and validates all filters/pagination.
- [ ] Catalogue services and routes have meaningful tests, including error cases.
- [ ] Frontend home/browse/detail consume the real API and show loading/error/empty states.
- [ ] No external anime API, scraper, provider, embed, arbitrary remote media URL or fallback is present in the active runtime.
- [ ] Admin mutations are protected by server-side ADMIN authorization; no bypass or insecure temporary credential.
- [ ] Lint, typecheck, tests and production builds pass in CI.
- [ ] Anime-streaming remains unchanged; legacy source remains untouched.

**Phase boundary:** Phase 2 is catalogue-only. First-party playback and secure media delivery are Phase 3. Full user accounts and personal library are Phase 4.
