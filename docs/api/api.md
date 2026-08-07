# API Reference

## Backend API (port 4000)

### Health Check
```
GET /health
```
Returns service status and Redis connection state.

### Anime

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/anime` | List anime (query params: `status`, `page`, `limit`) |
| GET | `/api/anime/{id}` | Get anime details by ID |
| GET | `/api/anime/{id}/episodes` | Get episode list for an anime |
| GET | `/api/anime/{id}/stream/{episode}` | Get stream URL (query params: `quality`) |
| GET | `/api/top` | Get top/popular anime (query params: `page`, `limit`) |

### Search
```
GET /api/search?q=<query>
```

### Schedule
```
GET /api/schedule
```

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/{id}/preferences` | Get user preferences |
| PATCH | `/api/users/{id}/preferences` | Update user preferences |
| GET | `/api/users/{id}/history` | Get watch history |
| GET | `/api/users/{id}/favorites` | Get favorite anime |
| POST | `/api/users/{id}/favorites` | Add anime to favorites |

### Downloads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/downloads/{id}` | Get download list |
| POST | `/api/downloads` | Queue a new download |
| DELETE | `/api/downloads/cache/{id}` | Clear downloads cache |

## ShivraAPI (port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/anime` | List anime from Jikan |
| GET | `/anime/{id}` | Anime details from Jikan |
| GET | `/anime/{id}/episodes` | Episodes from Jikan |
| GET | `/anime/{id}/stream/{episode}` | Scrape video stream URL |
| GET | `/search?q=` | Search Jikan |
| GET | `/top` | Top anime from Jikan |
| GET | `/schedule` | Weekly schedule from Jikan |
