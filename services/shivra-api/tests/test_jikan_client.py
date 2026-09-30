import pytest

from scrapers.jikan_client import JikanClient


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        self.calls.append((url, params))
        page = (params or {}).get("page", 1)
        if page == 1:
            return FakeResponse({
                "data": [{"mal_id": 1}, {"mal_id": 2}],
                "pagination": {
                    "has_next_page": True,
                    "last_visible_page": 2,
                    "current_page": 1,
                },
            })
        return FakeResponse({
            "data": [{"mal_id": 3}],
            "pagination": {
                "has_next_page": False,
                "last_visible_page": 2,
                "current_page": 2,
            },
        })


@pytest.mark.asyncio
async def test_fetch_episodes_follows_all_pages(monkeypatch):
    import scrapers.jikan_client as module

    client = FakeAsyncClient()
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda *args, **kwargs: client)

    result = await JikanClient().fetch_episodes("1")

    assert [episode["mal_id"] for episode in result["data"]] == [1, 2, 3]
    assert [params["page"] for _, params in client.calls] == [1, 2]
    assert result["pagination"]["has_next_page"] is False
