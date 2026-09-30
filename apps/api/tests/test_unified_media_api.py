import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.media_api.models import Media, MediaSource, MediaType
from src.media_api.services.aggregator import aggregator


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_unified_search_route(client, monkeypatch):
    async def fake_search(query, types, limit):
        return [Media(id="anilist:anime:1", source=MediaSource.ANILIST, source_id="1", type=MediaType.ANIME, title="Frieren")]

    monkeypatch.setattr(aggregator, "search", fake_search)
    response = client.get("/v1/search?q=frieren&type=anime&limit=5")
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1


def test_unified_trending_route(client, monkeypatch):
    async def fake_trending(types, limit):
        return [Media(id="anilist:anime:1", source=MediaSource.ANILIST, source_id="1", type=MediaType.ANIME, title="Frieren")]

    monkeypatch.setattr(aggregator, "trending", fake_trending)
    response = client.get("/v1/trending?type=anime&limit=5")
    assert response.status_code == 200


def test_unified_schedule_route(client, monkeypatch):
    async def fake_schedule(date, country):
        return [Media(id="tvmaze:tv:1", source=MediaSource.TVMAZE, source_id="1", type=MediaType.TV, title="Example")]

    monkeypatch.setattr(aggregator, "schedule", fake_schedule)
    response = client.get("/v1/schedule?date=2026-10-01&country=KE")
    assert response.status_code == 200


def test_unified_media_not_found(client, monkeypatch):
    async def fake_get_media(media_id):
        return None

    monkeypatch.setattr(aggregator, "get_media", fake_get_media)
    response = client.get("/v1/media/anilist:anime:999999")
    assert response.status_code == 404


def test_schedule_rejects_invalid_date(client):
    response = client.get("/v1/schedule?date=not-a-date&country=KE")
    assert response.status_code == 422
