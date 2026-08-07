# FAQ

## What is Samren?

Samren is an anime streaming marketplace that aggregates anime data from the Jikan API (unofficial MyAnimeList API) and provides video stream links via WCOStream scraping.

## Can I host my own instance?

Yes. See the [Setup Guide](./setup.md) for instructions.

## What data sources does Samren use?

- **Jikan API** — anime metadata, episode lists, schedules, top anime lists
- **WCOStream** — video stream embed URLs (scraped via the ShivraAPI service)

## How does caching work?

The backend API Gateway caches responses from ShivraAPI in Redis. Stream URLs are cached for 1 hour; general API responses for 5 minutes.

## What player options are available?

- **MPV** — External MPV player
- **Browser** — HTML5 video player
- **Auto** — Automatically selects based on device
