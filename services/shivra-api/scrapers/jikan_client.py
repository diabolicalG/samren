import logging
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


class JikanClient:
    """Async client for the Jikan API (unofficial MyAnimeList API)."""

    BASE_URL = "https://api.jikan.moe/v4"
    TIMEOUT = 30.0

    def __init__(self, timeout: float = TIMEOUT, client: Optional[httpx.AsyncClient] = None):
        self.timeout = timeout
        self._client = client

    def set_client(self, client: httpx.AsyncClient) -> None:
        self._client = client

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def fetch_anime(self, anime_id: str) -> Dict[str, Any]:
        client = self._get_client()
        response = await client.get(f"{self.BASE_URL}/anime/{anime_id}")
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
        params: Dict[str, Any] = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        if genres:
            params["genres"] = genres
        if q:
            params["q"] = q

        client = self._get_client()
        response = await client.get(f"{self.BASE_URL}/anime", params=params)
        response.raise_for_status()
        return response.json()

    async def fetch_episodes(self, anime_id: str) -> Dict[str, Any]:
        client = self._get_client()
        url = f"{self.BASE_URL}/anime/{anime_id}/episodes"
        page = 1
        all_data = []
        last_response: Dict[str, Any] = {}

        while True:
            response = await client.get(url, params={"page": page})
            response.raise_for_status()
            payload = response.json()
            last_response = payload
            all_data.extend(payload.get("data") or [])

            pagination = payload.get("pagination") or {}
            last_page = pagination.get("last_visible_page")
            if (
                not pagination.get("has_next_page")
                or not last_page
                or page >= last_page
            ):
                break
            page += 1

        last_response["data"] = all_data
        pagination = last_response.setdefault("pagination", {})
        pagination["current_page"] = 1
        pagination["has_next_page"] = False
        pagination["last_visible_page"] = page
        return last_response

    async def fetch_top_anime(self, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        client = self._get_client()
        response = await client.get(
            f"{self.BASE_URL}/top/anime",
            params={"page": page, "limit": limit},
        )
        response.raise_for_status()
        return response.json()

    async def search_anime(
        self, query: str, page: int = 1, limit: int = 20
    ) -> Dict[str, Any]:
        client = self._get_client()
        response = await client.get(
            f"{self.BASE_URL}/anime",
            params={"q": query, "page": page, "limit": limit},
        )
        response.raise_for_status()
        return response.json()

    async def fetch_genres(self) -> Dict[str, Any]:
        client = self._get_client()
        response = await client.get(f"{self.BASE_URL}/genres/anime")
        response.raise_for_status()
        return response.json()

    async def fetch_schedule(
        self, day: Optional[str] = None, page: int = 1
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"page": page}
        if day:
            params["day"] = day

        client = self._get_client()
        response = await client.get(f"{self.BASE_URL}/schedule", params=params)
        response.raise_for_status()
        return response.json()

    async def fetch_title(self, anime_id: str) -> Optional[str]:
        try:
            data = await self.fetch_anime(anime_id)
        except httpx.HTTPError:
            logger.warning("Failed to resolve title for anime_id=%s", anime_id, exc_info=True)
            return None
        anime = data.get("data") or {}
        title = anime.get("title")
        return title if isinstance(title, str) and title.strip() else None
