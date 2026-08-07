# Setup Guide

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Python** >= 3.12
- **PostgreSQL** >= 16
- **Redis** >= 7
- **Docker** (optional, for containerized setup)

## Installation

### 1. Clone and install dependencies

```bash
git clone <repository-url> samren
cd samren

# Install Node.js dependencies
pnpm install

# Install Python dependencies
pip install -r apps/api/requirements.txt
pip install -r services/shivra-api/requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start services

```bash
# Option A: Docker (all services)
docker-compose -f docker/docker-compose.yml up --build

# Option B: Local development
# Terminal 1 - Frontend
pnpm dev:web

# Terminal 2 - Backend API
pnpm dev:api

# Terminal 3 - ShivraAPI
pnpm dev:shivra
```

### 4. Access

| Service | URL |
|---------|-----|
| Frontend (Web) | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Admin Dashboard | http://localhost:3001 |
| ShivraAPI | http://localhost:8000 |
| API Health | http://localhost:4000/health |
| ShivraAPI Health | http://localhost:8000/health |

## Database Setup

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Open Prisma Studio
pnpm prisma:studio
```

## Troubleshooting

- **Port conflicts**: Ensure ports 3000, 4000, 3001, 8000, 5432, 6379 are free
- **Redis not connecting**: Ensure Redis is running (`redis-server`)
- **API can't reach ShivraAPI**: Check `SHIVRA_API_URL` in `.env`
