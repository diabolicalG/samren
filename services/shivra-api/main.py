from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
from typing import Optional, List, Dict, Any

from scrapers.jikan_client import JikanClient
from scrapers.wco_scraper import WCOStreamScraper
from scrapers.transform import (
    transform_anime,
    transform_anime_list_paginated,
    transform_episode,
    transform_genre as _transform_genre,
)


app = FastAPI(
    title="ShivraAPI",
    description="ShivraAPI - Anime data source and video stream scraper",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

jikan = JikanClient()
wco = WCOStreamScraper()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "shivra-api"}


@app.get("/anime")
async def list_anime(
    status: Optional[str] = None,
    genres: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
):
    """Fetch anime list from Jikan API."""
    try:
        result = await jikan.fetch_anime_list(
            status=status, genres=genres, q=q, page=page, limit=limit
        )
        paginated = transform_anime_list_paginated(result)
        paginated["page"] = page
        paginated["limit"] = limit
        return {
            "success": True,
            "data": paginated,
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/anime/{anime_id}")
async def get_anime(anime_id: str):
    """Fetch anime details from Jikan API by ID."""
    try:
        result = await jikan.fetch_anime(anime_id)
        anime = transform_anime(result["data"])
        return {"success": True, "data": anime}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/anime/{anime_id}/episodes")
async def get_episodes(anime_id: str):
    """Fetch episode list from Jikan API."""
    try:
        result = await jikan.fetch_episodes(anime_id)
        episodes = result["data"]
        mapped = [
            transform_episode(ep, anime_id, idx)
            for idx, ep in enumerate(episodes or [])
        ]
        return {"success": True, "data": mapped}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/anime/{anime_id}/stream/{episode}")
async def get_stream(anime_id: str, episode: int, quality: str = "1080p"):
    """Scrape video stream URL from WCOStream.

    Uses the WCOStream scraper to extract the embed link for the given episode.
    Falls back to constructing a standard embed URL if scraping fails.
    """
    try:
        stream_url = await wco.extract_stream_url(anime_id, episode, quality, jikan_client=jikan)
        return {
            "success": True,
            "data": {
                "streamUrl": stream_url,
                "quality": quality,
                "animeId": anime_id,
                "episode": episode,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to extract stream: {str(e)}")


@app.get("/search")
async def search(q: str = Query(..., min_length=1), page: int = 1, limit: int = 20):
    """Search anime via Jikan API."""
    try:
        result = await jikan.search_anime(q, page=page, limit=limit)
        paginated = transform_anime_list_paginated(result)
        pag = result.get("pagination") or {}
        pag_items = pag.get("items") or {}
        total = pag_items.get("total")
        if total is None:
            total = pag_items.get("count", len(result.get("data") or []))
        last_page = pag.get("last_visible_page", page)
        return {
            "success": True,
            "data": {
                "animes": paginated["items"],
                "total": total,
                "page": page,
                "hasNext": page < last_page,
            },
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/top")
async def get_top(page: int = 1, limit: int = 50):
    """Fetch top/popular anime from Jikan API."""
    try:
        result = await jikan.fetch_top_anime(page=page, limit=limit)
        paginated = transform_anime_list_paginated(result)
        paginated["page"] = page
        paginated["limit"] = limit
        return {
            "success": True,
            "data": paginated,
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/genres")
async def get_genres():
    """Fetch the list of anime genres from Jikan API."""
    try:
        result = await jikan.fetch_genres()
        mapped = [_transform_genre(g, idx) for idx, g in enumerate(result.get("data", []) or [])]
        return {"success": True, "data": mapped}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/schedule")
async def get_schedule(day: Optional[str] = None):
    """Fetch weekly schedule from Jikan API, optionally filtered by day."""
    try:
        result = await jikan.fetch_schedule(day=day)
        raw_schedule = result.get("data") or {}
        transformed_schedule: Dict[str, Any] = {}
        for day_name, anime_list in raw_schedule.items():
            if isinstance(anime_list, list):
                transformed_schedule[day_name] = [
                    transform_anime(a) for a in anime_list if isinstance(a, dict)
                ]
            else:
                transformed_schedule[day_name] = anime_list
        return {"success": True, "data": transformed_schedule}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
