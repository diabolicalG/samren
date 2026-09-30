from typing import List, Optional

from ..config import settings
from ..http import request_json
from ..models import Media, MediaSource, MediaType
from .base import ProviderAdapter


class TMDBAdapter(ProviderAdapter):
    name = "TMDB"
    source = MediaSource.TMDB.value

    def _img(self, path: Optional[str], size: str = "w500") -> Optional[str]:
        return f"{settings.tmdb_image_base}/{size}{path}" if path else None

    def _map(self, node: dict, media_type: MediaType) -> Media:
        title = node.get("title") or node.get("name") or ""
        date = node.get("release_date") or node.get("first_air_date") or ""
        year = int(date[:4]) if len(date) >= 4 and date[:4].isdigit() else None
        return Media(
            id=self.make_id(str(node["id"]), media_type), source=MediaSource.TMDB,
            source_id=f"{media_type.value}:{node['id']}", type=media_type, title=title,
            title_original=node.get("original_title") or node.get("original_name"), synopsis=node.get("overview"),
            poster_url=self._img(node.get("poster_path")), backdrop_url=self._img(node.get("backdrop_path"), "w1280"),
            rating=node.get("vote_average"), genres=[], status=None, release_year=year,
            total_episodes=node.get("number_of_episodes"),
            runtime_minutes=node.get("runtime") or (node.get("episode_run_time") or [None])[0],
        )

    async def search(self, query: str, limit: int = 20) -> List[Media]:
        if not settings.tmdb_api_key:
            return []
        data = await request_json("GET", f"{settings.tmdb_base_url}/search/multi", params={"api_key": settings.tmdb_api_key, "query": query, "include_adult": False})
        out = []
        for node in data.get("results", []):
            kind = node.get("media_type")
            if kind == "movie": out.append(self._map(node, MediaType.MOVIE))
            elif kind == "tv": out.append(self._map(node, MediaType.TV))
            if len(out) >= limit: break
        return out

    async def trending(self, limit: int = 20) -> List[Media]:
        if not settings.tmdb_api_key:
            return []
        data = await request_json("GET", f"{settings.tmdb_base_url}/trending/all/week", params={"api_key": settings.tmdb_api_key})
        out = []
        for node in data.get("results", []):
            kind = node.get("media_type")
            if kind == "movie": out.append(self._map(node, MediaType.MOVIE))
            elif kind == "tv": out.append(self._map(node, MediaType.TV))
            if len(out) >= limit: break
        return out

    async def get_media(self, source_id: str) -> Optional[Media]:
        if not settings.tmdb_api_key:
            return None
        if ":" in source_id:
            kind, ident = source_id.split(":", 1)
        else:
            kind, ident = "movie", source_id
        if kind not in {"movie", "tv"} or not ident.isdigit():
            return None
        media_type = MediaType.MOVIE if kind == "movie" else MediaType.TV
        node = await request_json("GET", f"{settings.tmdb_base_url}/{kind}/{ident}", params={"api_key": settings.tmdb_api_key})
        media = self._map(node, media_type)
        media.genres = [g["name"] for g in (node.get("genres") or []) if g.get("name")]
        credits = await request_json("GET", f"{settings.tmdb_base_url}/{kind}/{ident}/credits", params={"api_key": settings.tmdb_api_key})
        for c in (credits.get("cast") or [])[:15]:
            media.people.append({"id": str(c.get("id")), "name": c.get("name") or "", "role": "actor", "character": c.get("character"), "image_url": self._img(c.get("profile_path"), "w185")})
        return media
