from datetime import datetime, timezone
from typing import Dict, Optional


class ProviderHealthRegistry:
    def __init__(self, providers: list[str]) -> None:
        self._state: Dict[str, dict] = {
            provider: {
                "status": "unknown",
                "failures": 0,
                "last_error": None,
                "last_success_at": None,
            }
            for provider in providers
        }

    def record_success(self, provider: str) -> None:
        state = self._state.setdefault(provider, {})
        state.update({
            "status": "healthy",
            "failures": 0,
            "last_error": None,
            "last_success_at": datetime.now(timezone.utc).isoformat(),
        })

    def record_failure(self, provider: str, error: Exception) -> None:
        state = self._state.setdefault(provider, {})
        failures = int(state.get("failures", 0)) + 1
        state.update({
            "status": "degraded",
            "failures": failures,
            "last_error": str(error),
        })

    def snapshot(self) -> Dict[str, dict]:
        return {name: dict(state) for name, state in self._state.items()}


provider_health = ProviderHealthRegistry(["anilist", "tmdb", "tvmaze"])
