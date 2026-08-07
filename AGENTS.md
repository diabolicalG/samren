# Samren Development Rules

## Project Structure
- `apps/web/` — Next.js frontend (React 19, TypeScript)
- `apps/api/` — Python FastAPI backend API gateway
- `apps/admin/` — Next.js admin dashboard
- `services/shivra-api/` — Python data source & scraper (FastAPI + requests/BeautifulSoup)
- `packages/` — Shared packages (ui, api-client, types, hooks, utils)
- `prisma/` — Database schema (PostgreSQL)
- `docker/` — Dockerfiles and docker-compose

## Naming
- Project name: **samren**
- Shared packages prefixed with `@samren/`
- Python packages use snake_case module names

## Architecture
```
Browser (Next.js)
  → Anichi Backend (FastAPI on :4000)
    → Cache Layer (Redis)
      → ShivraAPI (Python scraper on :8000)
        → Jikan API / WCOStream
```

## Python Backend
- FastAPI with async httpx for upstream calls
- Redis for caching (Cache Layer)
- Environment: `REDIS_URL`, `SHIVRA_API_URL`, `CORS_ORIGIN`

## Frontend
- Next.js App Router
- Shared UI components in `@samren/ui`
- Typed API client in `@samren/api-client`
- React Query for data fetching
- All API calls go through `NEXT_PUBLIC_API_URL`
