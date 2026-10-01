from datetime import datetime, timedelta, timezone
from typing import Dict


class ProviderUnavailableError(RuntimeError):
    pass


class ProviderHealthRegistry:
    def __init__(self, providers: list[str], failure_threshold: int = 5, cooldown_seconds: int = 30) -> None:
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self._state: Dict[str, dict] = {
            provider: {
                "status": "unknown",
                "failures": 0,
                "last_error": None,
                "last_success_at": None,
                "open_until": None,
            }
            for provider in providers
        }

    def can_request(self, provider: str) -> bool:
        state = self._state.setdefault(provider, {
            "status": "unknown",
            "failures": 0,
            "last_error": None,
            "last_success_at": None,
            "open_until": None,
        })
        if state.get("status") == "half_open":
            return False

        open_until = state.get("open_until")
        if not open_until:
            return True
        if datetime.now(timezone.utc) >= datetime.fromisoformat(open_until):
            state["status"] = "half_open"
            state["open_until"] = None
            return True
        return False

    def record_success(self, provider: str) -> None:
        state = self._state.setdefault(provider, {})
        state.update({
            "status": "healthy",
            "failures": 0,
            "last_error": None,
            "last_success_at": datetime.now(timezone.utc).isoformat(),
            "open_until": None,
        })

    def record_failure(self, provider: str, error: Exception) -> None:
        state = self._state.setdefault(provider, {})
        failures = int(state.get("failures", 0)) + 1
        opened = failures >= self.failure_threshold
        state.update({
            "status": "open" if opened else "degraded",
            "failures": failures,
            "last_error": str(error),
            "open_until": (
                (datetime.now(timezone.utc) + timedelta(seconds=self.cooldown_seconds)).isoformat()
                if opened
                else None
            ),
        })

    def snapshot(self) -> Dict[str, dict]:
        return {name: dict(state) for name, state in self._state.items()}


provider_health = ProviderHealthRegistry(["anilist", "tmdb", "tvmaze"])
