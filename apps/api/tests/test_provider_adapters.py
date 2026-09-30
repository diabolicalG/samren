import pytest

from src.media_api.adapters.anilist import AniListAdapter
from src.media_api.adapters.tvmaze import TVmazeAdapter
from src.media_api.models import MediaType


@pytest.mark.asyncio
async def test_anilist_get_media_accepts_namespaced_id(monkeypatch):
    adapter = AniListAdapter()

    async def fake_post(query, variables):
        assert variables == {"id": 154587}
        return {"data": {"Media": {"id": 154587, "title": {"romaji": "Frieren"}}}}

    monkeypatch.setattr(adapter, "_post", fake_post)
    media = await adapter.get_media("anime:154587")

    assert media is not None
    assert media.type is MediaType.ANIME
    assert media.source_id == "154587"


@pytest.mark.asyncio
async def test_anilist_get_media_rejects_malformed_id(monkeypatch):
    adapter = AniListAdapter()

    async def fail_post(*args, **kwargs):
        raise AssertionError("provider must not be called for malformed IDs")

    monkeypatch.setattr(adapter, "_post", fail_post)
    assert await adapter.get_media("anime:not-a-number") is None


@pytest.mark.asyncio
async def test_tvmaze_get_media_accepts_namespaced_id(monkeypatch):
    adapter = TVmazeAdapter()

    async def fake_request_json(method, url, **kwargs):
        return {"id": 82, "name": "Example", "genres": []}

    import src.media_api.adapters.tvmaze as module
    monkeypatch.setattr(module, "request_json", fake_request_json)

    media = await adapter.get_media("tv:82")

    assert media is not None
    assert media.type is MediaType.TV
    assert media.source_id == "82"
