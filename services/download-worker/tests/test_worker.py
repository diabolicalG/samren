import os

os.environ.setdefault("APP_ENV", "worker")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test-worker.db")

from worker import resolve_episode_number


def test_resolve_episode_id_to_episode_number():
    episodes = [
        {"mal_id": 101, "number": 1},
        {"mal_id": 205, "number": 2},
    ]
    assert resolve_episode_number(episodes, "205") == 2


def test_resolve_legacy_episode_number():
    episodes = [
        {"mal_id": 101, "number": 1},
        {"mal_id": 205, "number": 2},
    ]
    assert resolve_episode_number(episodes, "2") == 2


def test_unknown_episode_returns_none():
    episodes = [{"mal_id": 101, "number": 1}]
    assert resolve_episode_number(episodes, "999") is None
