import httpx
from typing import Optional, Dict, Any


class JikanClient:
    """Async client for the Jikan API (unofficial MyAnimeList API)."""

    BASE_URL = "https://api.jikan.moe/v4"
    TIMEOUT = 30.0

    def __init__(self, timeout: float = TIMEOUT):
        self.timeout = timeout

    async def fetch_anime(self, anime_id: str) -> Dict[str, Any]:
        """Fetch anime details by Jikan ID or slug."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.BASE_URL}/anime/{anime_id}"
            response = await client.get(url)
            response.raise_for_status()
            return response.json()

    async def fetch_anime_list(
        self,
        status: Optional[str] = None,
        genres: Optional[str] = None,
        q: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Fetch a paginated list of anime, optionally filtered by status/genre/search."""
        params: Dict[str, Any] = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        if genres:
            params["genres"] = genres
        if q:
            params["q"] = q

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.BASE_URL}/anime"
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()

    async def fetch_episodes(self, anime_id: str) -> Dict[str, Any]:
        """Fetch the episode list for a given anime."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.BASE_URL}/anime/{anime_id}/episodes"
            response = await client.get(url)
            response.raise_for_status()
            return response.json()

    async def fetch_top_anime(self, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        """Fetch top/popular anime."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.BASE_URL}/top/anime"
            response = await client.get(url, params={"page": page, "limit": limit})
            response.raise_for_status()
            return response.json()

    async def search_anime(self, query: str, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """Search for anime by keyword."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.BASE_URL}/anime"
            response = await client.get(
                url,
                params={"q": query, "page": page, "limit": limit},
            )
            response.raise_for_status()
            return response.json()

    async def fetch_genres(self) -> Dict[str, Any]:
        """Fetch the list of anime genres from Jikan."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.BASE_URL}/genres/anime"
            response = await client.get(url)
            response.raise_for_status()
            return response.json()

    async def fetch_schedule(
        self, day: Optional[str] = None, page: int = 1
    ) -> Dict[str, Any]:
        """Fetch the anime schedule, optionally filtered by day of week."""
        params: Dict[str, Any] = {"page": page}
        if day:
            params["day"] = day

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.BASE_URL}/schedule"
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()

    async def fetch_title(self, anime_id: str) -> Optional[str]:
        """Fetch only the primary title for an anime by Jikan ID.

        Returns the raw title string (used for slug resolution) or ``None``.
        """
        try:
            data = await self.fetch_anime(anime_id)
        except Exception:
            return None
        anime = data.get("data") or {}
        return anime.get("title")
