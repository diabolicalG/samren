from abc import ABC, abstractmethod
from typing import List, Optional

from ..models import Episode, Media, MediaType, Person


class ProviderAdapter(ABC):
    name: str
    source: str

    @abstractmethod
    async def search(self, query: str, limit: int = 20) -> List[Media]: ...

    @abstractmethod
    async def get_media(self, source_id: str) -> Optional[Media]: ...

    async def get_episodes(self, source_id: str) -> List[Episode]:
        return []

    async def get_credits(self, source_id: str) -> List[Person]:
        return []

    async def trending(self, limit: int = 20) -> List[Media]:
        return []

    async def schedule(self, date: str, country: str = "KE") -> List[Media]:
        return []

    def make_id(self, source_id: str, media_type: MediaType | None = None) -> str:
        if media_type:
            return f"{self.source}:{media_type.value}:{source_id}"
        return f"{self.source}:{source_id}"
