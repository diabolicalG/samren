"""Transform Jikan API responses into samren-typed objects."""

from typing import Any, Dict, List, Optional
import re
from datetime import datetime

NOW_ISO = datetime.utcnow().isoformat()


def _duration_to_minutes(duration: Any) -> int:
    """Parse a Jikan duration string like '24 min per ep' into an integer minutes."""
    if not isinstance(duration, str) or not duration:
        return 0
    match = re.match(r"(\d+)", duration)
    if match:
        return int(match.group(1))
    return 0


_STATUS_MAP = {
    "Currently Airing": "ongoing",
    "Finished Airing": "completed",
    "Not yet aired": "tba",
}


def _map_status(status: Any) -> str:
    if not isinstance(status, str):
        return "released"
    return _STATUS_MAP.get(status, "released")


_TYPE_MAP = {
    "tv": "tv",
    "movie": "movie",
    "ova": "ova",
    "special": "special",
    "ona": "ona",
    "music": "music",
}


def _map_type(type_str: Any) -> str:
    if not isinstance(type_str, str):
        return "tv"
    return _TYPE_MAP.get(type_str.lower(), "tv")


def _normalize_season(season: Any) -> Optional[str]:
    if not isinstance(season, str):
        return None
    season_lower = season.lower()
    if season_lower in ("winter", "spring", "summer", "fall"):
        return season_lower
    return None


def _normalize_year(year: Any) -> int:
    if isinstance(year, (int, float)):
        return int(year)
    if isinstance(year, str):
        try:
            return int(year)
        except ValueError:
            return 0
    return 0


def transform_genre(jikan_genre: Dict[str, Any], idx: int = 0) -> Dict[str, Any]:
    return {
        "id": str(jikan_genre.get("mal_id", idx)),
        "name": jikan_genre.get("name", ""),
        "description": jikan_genre.get("description"),
    }


def transform_studio(jikan_studio: Dict[str, Any], idx: int = 0) -> Dict[str, Any]:
    return {
        "id": str(jikan_studio.get("mal_id", idx)),
        "name": jikan_studio.get("name", ""),
        "logo": jikan_studio.get("logo_url") or jikan_studio.get("logo"),
        "url": jikan_studio.get("url"),
    }


def transform_anime(jikan_anime: Dict[str, Any]) -> Dict[str, Any]:
    """Map a raw Jikan anime object to the samren Anime shape."""
    images = jikan_anime.get("images") or {}
    jpg = images.get("jpg") or {}

    genres = [transform_genre(g, idx) for idx, g in enumerate(jikan_anime.get("genres") or [])]
    studios = [transform_studio(s, idx) for idx, s in enumerate(jikan_anime.get("studios") or [])]

    trailer = jikan_anime.get("trailer")
    trailer_url: Optional[str] = None
    trailer_site: Optional[str] = None
    if isinstance(trailer, dict):
        trailer_url = trailer.get("url")
        trailer_site = trailer.get("site") or trailer.get("source")

    duration_min = _duration_to_minutes(jikan_anime.get("duration"))
    year = jikan_anime.get("year") or jikan_anime.get("aired", {}).get("from")
    if year and not isinstance(year, int):
        if isinstance(year, str):
            try:
                year = int(year[:4])
            except (ValueError, TypeError):
                year = 0
    if not isinstance(year, int):
        year = 0

    description = (
        jikan_anime.get("synopsis")
        or jikan_anime.get("description")
        or jikan_anime.get("background")
        or ""
    )

    return {
        "id": str(jikan_anime.get("mal_id", "")),
        "title": jikan_anime.get("title", ""),
        "nativeTitle": jikan_anime.get("title_japanese"),
        "description": description,
        "coverImage": jpg.get("image_url") or jpg.get("large_image_url") or jpg.get("small_image_url") or "",
        "bannerImage": jpg.get("large_image_url") or jikan_anime.get("banner_image"),
        "rating": jikan_anime.get("score") or 0,
        "status": _map_status(jikan_anime.get("status")),
        "type": _map_type(jikan_anime.get("type")),
        "episodes": jikan_anime.get("episodes") or 0,
        "duration": duration_min,
        "year": year,
        "season": _normalize_season(jikan_anime.get("season")),
        "genres": genres,
        "studios": studios,
        "tags": [],
        "source": jikan_anime.get("source", ""),
        "trailer": {"url": trailer_url, "site": trailer_site} if trailer_url else None,
        "createdAt": jikan_anime.get("created_at") or NOW_ISO,
        "updatedAt": jikan_anime.get("updated_at") or NOW_ISO,
    }


def transform_episode(jikan_episode: Dict[str, Any], anime_id: str, idx: int = 0) -> Dict[str, Any]:
    """Map a raw Jikan episode object to the samren Episode shape."""
    duration = 24
    if isinstance(jikan_episode.get("duration"), str):
        match = re.match(r"(\d+)", jikan_episode["duration"])
        if match:
            duration = int(match.group(1))

    aired = jikan_episode.get("aired")
    air_date: Optional[str] = None
    if isinstance(aired, dict):
        air_date = aired.get("iso") or aired.get("iso_8601")
    elif isinstance(aired, str):
        air_date = aired

    images = jikan_episode.get("images") or {}
    jpg = images.get("jpg") or {}
    image_url = jpg.get("image_url") or jpg.get("large_image_url") or jikan_episode.get("image")

    return {
        "id": str(jikan_episode.get("mal_id", idx)),
        "animeId": anime_id,
        "number": jikan_episode.get("number", idx + 1),
        "title": jikan_episode.get("title"),
        "description": jikan_episode.get("synopsis") or jikan_episode.get("description"),
        "thumbnail": image_url,
        "duration": duration,
        "isFiller": jikan_episode.get("filler", False),
        "isPreview": jikan_episode.get("preview", False),
        "airDate": air_date,
        "createdAt": NOW_ISO,
        "updatedAt": NOW_ISO,
    }


def transform_anime_list(jikan_data: Any) -> List[Dict[str, Any]]:
    """Transform the ``data`` array of an anime list/search/top Jikan response."""
    if not isinstance(jikan_data, list):
        return []
    return [transform_anime(item) for item in jikan_data if isinstance(item, dict)]


def transform_anime_list_paginated(jikan_response: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a paginated Jikan anime list/search/top into samren PaginatedResult."""
    raw_data = jikan_response.get("data") or []
    items = transform_anime_list(raw_data)

    pag = jikan_response.get("pagination") or {}
    pag_items = pag.get("items") or {}
    total = pag_items.get("total")
    if total is None:
        total = pag_items.get("count", len(items))
    last_page = pag.get("last_visible_page", 1)
    current_page = pag.get("page", 1)

    return {
        "items": items,
        "total": total,
        "page": current_page,
        "limit": pag_items.get("per_page", 20),
        "hasNext": current_page < last_page,
    }
