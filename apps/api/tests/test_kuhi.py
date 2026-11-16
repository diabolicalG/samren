from src.main import app
from src.media_api.config import settings
from src.media_api.routers import kuhi


def test_kuhi_url_policy_requires_allowlisted_public_https(monkeypatch):
    monkeypatch.setattr(settings, "kuhi_stream_allowed_hosts", "stream.example,cdn.example")
    assert kuhi._safe_stream_url("https://video.stream.example/master.m3u8") == "https://video.stream.example/master.m3u8"
    assert kuhi._safe_stream_url("http://video.stream.example/master.m3u8") is None
    assert kuhi._safe_stream_url("https://127.0.0.1/private") is None
    assert kuhi._safe_stream_url("https://untrusted.example/master.m3u8") is None
    assert kuhi._safe_stream_url("https://user:pass@stream.example/master.m3u8") is None


def test_kuhi_stream_response_drops_provider_headers(monkeypatch):
    monkeypatch.setattr(settings, "kuhi_stream_allowed_hosts", "stream.example")
    streams = kuhi._safe_streams([{
        "url": "https://stream.example/master.m3u8",
        "type": "hls",
        "server": "Kuhi provider",
        "referer": "https://provider.example/",
        "headers": {"Cookie": "secret"},
        "subtitles": [{"url": "https://stream.example/en.vtt", "lang": "en", "label": "English"}],
    }])
    assert len(streams) == 1
    assert streams[0]["url"] == "https://stream.example/master.m3u8"
    assert "referer" not in streams[0]
    assert "headers" not in streams[0]
    assert streams[0]["subtitles"][0]["url"] == "https://stream.example/en.vtt"


def test_kuhi_extract_route_returns_only_validated_sources(monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setattr(settings, "kuhi_stream_allowed_hosts", "stream.example")

    async def fake_race(anilist_id, episode, audio, preferred=None):
        return {
            "provider": "anineko",
            "streams": [
                {"url": "https://stream.example/episode.m3u8", "type": "hls", "referer": "https://provider.example/"},
                {"url": "http://127.0.0.1/internal", "type": "hls"},
                {"url": "https://stream.example/embed", "type": "embed"},
            ],
        }

    monkeypatch.setattr(kuhi.provider_race, "race_watch", fake_race)
    with TestClient(app) as client:
        response = client.get("/v1/kuhi/extract/16498?e=2&type=sub")
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["streams"]) == 1
    assert body["streams"][0]["url"] == "https://stream.example/episode.m3u8"
    assert "referer" not in body["streams"][0]


def test_kuhi_extract_rejects_unknown_provider():
    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        response = client.get("/v1/kuhi/extract/16498?e=1&type=sub&provider=unknown")
    assert response.status_code == 422

def test_kuhi_outbound_transport_requires_allowlisted_https_hosts(monkeypatch):
    from src.providers._safe_http import validate_provider_url

    monkeypatch.setenv("KUHI_PROVIDER_ALLOWED_HOSTS", "graphql.anilist.co,provider.example")
    validate_provider_url("https://graphql.anilist.co/graphql")
    validate_provider_url("https://video.provider.example/master.m3u8")
    with pytest.raises(ValueError):
        validate_provider_url("http://provider.example/video")
    with pytest.raises(ValueError):
        validate_provider_url("https://127.0.0.1/internal")
    with pytest.raises(ValueError):
        validate_provider_url("https://untrusted.example/video")


def test_kuhi_outbound_transport_blocks_when_allowlist_is_empty(monkeypatch):
    from src.providers._safe_http import validate_provider_url

    monkeypatch.delenv("KUHI_PROVIDER_ALLOWED_HOSTS", raising=False)
    with pytest.raises(ValueError):
        validate_provider_url("https://graphql.anilist.co/graphql")
