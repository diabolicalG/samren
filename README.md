# Samren

Samren is a catalogue-first anime streaming application. The active application is being rebuilt around an application-owned catalogue, first-party media storage and a typed TypeScript API.

## Active architecture

- **Frontend:** React + Vite in `apps/frontend` (development origin: `http://localhost:5173`).
- **Backend:** Express + TypeScript in `apps/backend` (default API port: `4000`).
- **Database:** PostgreSQL managed through Prisma.
- **Shared contracts:** `packages/types` and `packages/api-client`.

Older Next.js, FastAPI, scraper and shared-package source is retained as legacy/reference material and is not part of the active pnpm workspace or the root development command. Do not use those legacy applications as the active runtime.

## Requirements

- Node.js 22 (Node.js 20+ is declared by the workspace).
- pnpm 9 or later.
- PostgreSQL 16 or a compatible supported PostgreSQL release.

## Local development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `apps/backend/.env.example` to `apps/backend/.env` and set a local PostgreSQL `DATABASE_URL`. Keep provider integrations disabled unless their host allowlists have been explicitly reviewed.

3. Generate the Prisma client, apply migrations and seed local fixtures:

   ```bash
   pnpm --filter @samren/backend db:generate
   pnpm --filter @samren/backend db:migrate:deploy
   pnpm --filter @samren/backend db:seed
   ```

4. Start the active frontend and backend:

   ```bash
   pnpm dev
   ```

The Vite frontend defaults to port 5173 and the Express API defaults to port 4000. The backend CORS origin must match the frontend origin.

## Useful commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The backend-specific database and administrator bootstrap scripts are defined in `apps/backend/package.json`. See `apps/backend/ADMIN_SETUP.md` for administrator provisioning instructions.

## Media and playback status

First-party media storage, upload, delivery and playback are being completed in Phase 3. Local storage uses `MEDIA_STORAGE_ROOT`; production deployments must use a persistent path outside the repository and outside public web roots.

Provider integrations are optional and disabled by default. They require explicit upstream and stream-host allowlists. First-party uploaded assets and transient provider-resolved streams are separate media paths. Do not treat a provider URL as a locally stored `MediaAsset`.

Phase 3 remains in progress until its security, browser playback, integration and operational acceptance gates are verified. A passing typecheck or jsdom test is not proof of real browser playback or live provider availability.

## Repository boundaries

All Samren implementation work belongs in this repository. The separate `diabolicalG/Anime-streaming` repository may be used as a read-only architecture reference; it must not be modified as part of Samren development.
