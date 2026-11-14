from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class MediaType(str, Enum):
    ANIME = "anime"
    MOVIE = "movie"
    TV = "tv"


class MediaSource(str, Enum):
    ANILIST = "anilist"
    TMDB = "tmdb"
    TVMAZE = "tvmaze"


class Episode(BaseModel):
    id: str
    media_id: str
    season_number: int = 1
    episode_number: int
    title: Optional[str] = None
    synopsis: Optional[str] = None
    air_date: Optional[str] = None
    thumbnail_url: Optional[str] = None
    runtime_minutes: Optional[int] = None


class Person(BaseModel):
    id: str
    name: str
    role: Optional[str] = None
    character: Optional[str] = None
    image_url: Optional[str] = None


class Provider(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None
    region: Optional[str] = None


class Availability(BaseModel):
    provider: Provider
    offer_type: str
    deep_link: Optional[str] = None
    quality: Optional[str] = None


class Media(BaseModel):
    id: str
    source: MediaSource
    source_id: str
    mal_id: Optional[str] = None
    type: MediaType
    title: str
    title_original: Optional[str] = None
    synopsis: Optional[str] = None
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    rating: Optional[float] = None
    genres: List[str] = Field(default_factory=list)
    status: Optional[str] = None
    release_year: Optional[int] = None
    total_episodes: Optional[int] = None
    runtime_minutes: Optional[int] = None
    episodes: List[Episode] = Field(default_factory=list)
    people: List[Person] = Field(default_factory=list)
    availability: List[Availability] = Field(default_factory=list)


class SearchResult(BaseModel):
    query: str
    total: int
    items: List[Media]
