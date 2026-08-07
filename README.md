# Samren

A modern anime streaming marketplace built as a monorepo with a Next.js frontend, a Python FastAPI backend, and a Python scraper/data source layer.

## Architecture

```
Browser (Next.js)
  → Anichi Backend (FastAPI on :4000)
    → Cache Layer (Redis)
      → ShivraAPI (Python scraper on :8000)
        → Jikan API / WCOStream
```

## Project Structure

```
samren/
├── apps/
│   ├── web/              # Next.js frontend (port 3000)
│   ├── api/              # Python FastAPI backend API gateway (port 4000)
│   └── admin/            # Next.js admin dashboard (port 3001)
├── services/
│   └── shivra-api/       # Python data source & scraper (port 8000)
├── packages/
│   ├── ui/               # Shared UI components
│   ├── api-client/       # Typed API client (TypeScript)
│   ├── types/            # Shared TypeScript types
│   ├── hooks/            # React hooks (React Query)
│   └── utils/            # Shared utility functions
├── prisma/               # Database schema (PostgreSQL)
├── public/               # Static assets
├── docs/                 # Documentation
├── docker/               # Dockerfiles & docker-compose
└── AGENTS.md             # Development rules
```

## Routes

### Frontend (Next.js)
| Route | Description |
|-------|-------------|
| `/` | Home - trending anime |
| `/anime/ongoing` | Currently airing anime |
| `/anime/completed` | Finished anime |
| `/anime/popular` | Popular/trending anime |
| `/anime/[id]` | Anime detail page with episodes & downloads |
| `/search` | Search anime |
| `/genre` | Browse by genre |
| `/schedule` | Weekly anime schedule |
| `/history` | Watch history |
| `/downloads` | Download manager |
| `/favorites` | Favorite anime list |
| `/settings` | Player, quality, theme, cache settings |
| `/help` | Help & FAQ |
| `/profile` | User profile |
| `/admin` | Admin dashboard |

## Quick Start

### Using Docker (recommended)

```bash
cp .env.example .env
docker-compose -f docker/docker-compose.yml up --build
```

### Development (local)

```bash
# Terminal 1 - Frontend
cd apps/web && pnpm dev

# Terminal 2 - Backend API
cd apps/api && uvicorn src.main:app --port 4000 --reload

# Terminal 3 - ShivraAPI scraper
cd services/shivra-api && uvicorn main:app --port 8000 --reload

# Terminal 4 - Redis
redis-server
```

## Environment Variables

See `.env.example` for all required variables.

## MY BUDGET Demo App

A simple student budget demo is available at the repository root:

- `index.html` — static front-end UI
- `static/styles.css` — page styles
- `static/app.js` — client-side budget logic
- `mybudget_single_file.py` — FastAPI backend with authentication, transactions, and dashboard data

Run the demo using Miniforge Python:

```bash
C:\Users\Administrator\Miniforge3\python.exe -m pip install -r requirements.txt
C:\Users\Administrator\Miniforge3\python.exe mybudget_single_file.py
```

Open `http://localhost:8000` in your browser.

## License
