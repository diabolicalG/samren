# Unified Media API

The Samren gateway exposes a provider-neutral metadata surface under /v1 while preserving the existing /api/* anime, auth, user, and download endpoints.

## Endpoints

- GET /v1/search?q=<query>&type=anime&type=movie&limit=20
- GET /v1/media/{source}:{type}:{source_id}
- GET /v1/trending?type=anime&limit=20
- GET /v1/schedule?date=YYYY-MM-DD&country=KE

## Providers

- AniList: anime metadata, search, trending and character credits.
- TMDB: movie/TV search, trending, details, genres and cast. Requires TMDB_API_KEY.
- TVmaze: TV search, details, episodes, cast and country schedules.

Each adapter normalizes provider-specific responses into the shared Media model. Provider failures are isolated during fan-out so one unavailable provider does not discard successful responses from the others.

## Relationship to ShivraAPI

This layer is metadata aggregation. It does not replace the existing ShivraAPI scraper or stream-resolution endpoints. The existing /api/anime/*/stream/* path remains backed by ShivraAPI.

Redis is used as a best-effort cache. If Redis is unavailable, requests continue against the providers.
