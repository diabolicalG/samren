from typing import List, Optional

from ..config import settings
from ..http import request_json
from ..models import Media, MediaSource, MediaType
from .base import ProviderAdapter

SEARCH_QUERY = """
query ($search: String, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
      id idMal title { romaji english native } description(asHtml: false)
      coverImage { extraLarge large } bannerImage averageScore genres episodes status startDate { year }
    }
  }
}
"""
TRENDING_QUERY = """
query ($perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id idMal title { romaji english native } description(asHtml: false)
      coverImage { extraLarge large } bannerImage averageScore genres episodes status startDate { year }
    }
  }
}
"""
DETAIL_QUERY = """
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal title { romaji english native } description(asHtml: false)
    coverImage { extraLarge large } bannerImage averageScore genres episodes duration status startDate { year }
    characters(sort: ROLE, perPage: 15) { edges { role node { id name { full } image { large } } } }
  }
}
"""


class AniListAdapter(ProviderAdapter):
    name = "AniList"
    source = MediaSource.ANILIST.value

    async def _post(self, query: str, variables: dict) -> dict:
        return await request_json(
            "POST", settings.anilist_url,
            json_body={"query": query, "variables": variables},
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )

    def _map(self, node: dict) -> Media:
        titles = node.get("title") or {}
        title = titles.get("english") or titles.get("romaji") or titles.get("native") or ""
        cover = node.get("coverImage") or {}
        score = node.get("averageScore")
        return Media(
            id=self.make_id(str(node["id"]), MediaType.ANIME), source=MediaSource.ANILIST,
            source_id=str(node["id"]), mal_id=str(node["idMal"]) if node.get("idMal") else None, type=MediaType.ANIME, title=title,
            title_original=titles.get("native"), synopsis=node.get("description"),
            poster_url=cover.get("extraLarge") or cover.get("large"), backdrop_url=node.get("bannerImage"),
            rating=score / 10 if score is not None else None, genres=node.get("genres") or [],
            status=node.get("status"), release_year=(node.get("startDate") or {}).get("year"),
            total_episodes=node.get("episodes"), runtime_minutes=node.get("duration"),
        )

    async def search(self, query: str, limit: int = 20) -> List[Media]:
        data = await self._post(SEARCH_QUERY, {"search": query, "perPage": limit})
        return [self._map(n) for n in ((data.get("data") or {}).get("Page", {}).get("media") or [])]

    async def trending(self, limit: int = 20) -> List[Media]:
        data = await self._post(TRENDING_QUERY, {"perPage": limit})
        return [self._map(n) for n in ((data.get("data") or {}).get("Page", {}).get("media") or [])]

    async def get_media(self, source_id: str) -> Optional[Media]:
        data = await self._post(DETAIL_QUERY, {"id": int(source_id)})
        node = (data.get("data") or {}).get("Media")
        if not node:
            return None
        media = self._map(node)
        for edge in ((node.get("characters") or {}).get("edges") or []):
            person = edge.get("node") or {}
            media.people.append({
                "id": str(person.get("id")), "name": (person.get("name") or {}).get("full") or "",
                "role": edge.get("role"), "image_url": (person.get("image") or {}).get("large"),
            })
        return media
