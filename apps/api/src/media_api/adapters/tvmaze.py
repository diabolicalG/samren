import re
from typing import List, Optional

from ..config import settings
from ..http import request_json
from ..models import Episode, Media, MediaSource, MediaType, Person
from .base import ProviderAdapter

_TAG_RE = re.compile(r"<[^>]+>")


def _clean(value: Optional[str]) -> Optional[str]:
    return _TAG_RE.sub("", value).strip() if value else None


class TVmazeAdapter(ProviderAdapter):
    name = "TVmaze"
    source = MediaSource.TVMAZE.value

    def _map(self, node: dict) -> Media:
        image = node.get("image") or {}
        premiered = node.get("premiered") or ""
        year = int(premiered[:4]) if len(premiered) >= 4 and premiered[:4].isdigit() else None
        return Media(
            id=self.make_id(str(node["id"]), MediaType.TV), source=MediaSource.TVMAZE,
            source_id=str(node["id"]), type=MediaType.TV, title=node.get("name") or "",
            synopsis=_clean(node.get("summary")), poster_url=image.get("original") or image.get("medium"),
            backdrop_url=image.get("original"), rating=(node.get("rating") or {}).get("average"),
            genres=node.get("genres") or [], status=node.get("status"), release_year=year,
            runtime_minutes=node.get("averageRuntime"),
        )

    async def search(self, query: str, limit: int = 20) -> List[Media]:
        data = await request_json("GET", f"{settings.tvmaze_base_url}/search/shows", params={"q": query})
        return [self._map(item["show"]) for item in data[:limit] if item.get("show")]

    async def get_media(self, source_id: str) -> Optional[Media]:
        ident = source_id.removeprefix("tv:")
        if not ident.isdigit(): return None
        node = await request_json("GET", f"{settings.tvmaze_base_url}/shows/{source_id}", params={"embed": "episodes,cast"})
        if not node: return None
        media = self._map(node)
        for ep in ((node.get("_embedded") or {}).get("episodes") or []):
            media.episodes.append(Episode(id=f"tvmaze:ep:{ep['id']}", media_id=media.id, season_number=ep.get("season") or 1, episode_number=ep.get("number") or 0, title=ep.get("name"), synopsis=_clean(ep.get("summary")), air_date=ep.get("airdate") or None, thumbnail_url=(ep.get("image") or {}).get("medium"), runtime_minutes=ep.get("runtime")))
        for c in ((node.get("_embedded") or {}).get("cast") or []):
            person = c.get("person") or {}
            media.people.append(Person(id=str(person.get("id")), name=person.get("name") or "", role="actor", character=(c.get("character") or {}).get("name"), image_url=(person.get("image") or {}).get("medium")))
        return media

    async def get_episodes(self, source_id: str) -> List[Episode]:
        media = await self.get_media(source_id)
        return media.episodes if media else []

    async def schedule(self, date: str, country: str = "KE") -> List[Media]:
        data = await request_json("GET", f"{settings.tvmaze_base_url}/schedule", params={"date": date, "country": country})
        seen = {}
        for item in data:
            show = item.get("show") or {}
            key = str(show.get("id"))
            if key and key not in seen: seen[key] = self._map(show)
        return list(seen.values())
