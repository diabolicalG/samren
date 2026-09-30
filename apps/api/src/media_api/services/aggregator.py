import asyncio
from typing import Dict, List, Optional

from ..adapters.anilist import AniListAdapter
from ..adapters.base import ProviderAdapter
from ..adapters.tmdb import TMDBAdapter
from ..adapters.tvmaze import TVmazeAdapter
from ..cache import cached_json
from ..config import settings
from ..models import Media, MediaType


class Aggregator:
    """Fan-out/fan-in service for normalized metadata from multiple providers."""

    def __init__(self) -> None:
        self.adapters: List[ProviderAdapter] = [AniListAdapter(), TMDBAdapter(), TVmazeAdapter()]

    def _by_source(self) -> Dict[str, ProviderAdapter]:
        return {adapter.source: adapter for adapter in self.adapters}

    @staticmethod
    def _dedupe(items: List[Media]) -> List[Media]:
        seen = set()
        out = []
        for media in items:
            key = (media.type.value, media.title.strip().casefold(), media.release_year)
            if key in seen: continue
            seen.add(key)
            out.append(media)
        return out

    @staticmethod
    def _filter_types(items: List[Media], types: Optional[List[MediaType]]) -> List[Media]:
        return [m for m in items if m.type in set(types)] if types else items

    async def _gather(self, coros) -> List[Media]:
        results = await asyncio.gather(*coros, return_exceptions=True)
        merged = []
        for result in results:
            if isinstance(result, Exception):
                continue
            merged.extend(result)
        return merged

    async def search(self, query: str, types: Optional[List[MediaType]], limit: int) -> List[Media]:
        normalized = " ".join(query.split()).casefold()
        cache_key = f"media:search:{normalized}:{','.join(sorted(t.value for t in types)) if types else 'all'}:{limit}"
        async def fetch():
            merged = await self._gather([a.search(query, limit) for a in self.adapters])
            return [m.model_dump() for m in self._dedupe(self._filter_types(merged, types))[:limit]]
        raw = await cached_json(cache_key, settings.cache_ttl_search, fetch)
        return [Media.model_validate(item) for item in raw]

    async def get_media(self, media_id: str) -> Optional[Media]:
        parts = media_id.split(":", 2)
        if len(parts) < 2: return None
        source = parts[0]
        adapter = self._by_source().get(source)
        if adapter is None: return None
        source_id = parts[1] if len(parts) == 2 else ":".join(parts[1:])
        cache_key = f"media:detail:{media_id}"
        async def fetch():
            media = await adapter.get_media(source_id)
            return media.model_dump() if media else None
        raw = await cached_json(cache_key, settings.cache_ttl_detail, fetch)
        return Media.model_validate(raw) if raw else None

    async def trending(self, types: Optional[List[MediaType]], limit: int) -> List[Media]:
        cache_key = f"media:trending:{','.join(sorted(t.value for t in types)) if types else 'all'}:{limit}"
        async def fetch():
            merged = await self._gather([a.trending(limit) for a in self.adapters])
            return [m.model_dump() for m in self._dedupe(self._filter_types(merged, types))[:limit]]
        raw = await cached_json(cache_key, settings.cache_ttl_trending, fetch)
        return [Media.model_validate(item) for item in raw]

    async def schedule(self, date: str, country: str) -> List[Media]:
        cache_key = f"media:schedule:{date}:{country.upper()}"
        async def fetch():
            merged = await self._gather([a.schedule(date, country.upper()) for a in self.adapters])
            return [m.model_dump() for m in self._dedupe(merged)]
        raw = await cached_json(cache_key, settings.cache_ttl_trending, fetch)
        return [Media.model_validate(item) for item in raw]


aggregator = Aggregator()
