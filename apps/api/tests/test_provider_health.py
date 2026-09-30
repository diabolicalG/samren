from apps.api.src.media_api.health import ProviderHealthRegistry


def test_provider_circuit_opens_after_threshold():
    registry = ProviderHealthRegistry(["test"], failure_threshold=2, cooldown_seconds=60)
    assert registry.can_request("test")

    registry.record_failure("test", RuntimeError("one"))
    assert registry.can_request("test")

    registry.record_failure("test", RuntimeError("two"))
    assert not registry.can_request("test")
    assert registry.snapshot()["test"]["status"] == "open"


def test_half_open_allows_one_probe():
    registry = ProviderHealthRegistry(["test"], failure_threshold=1, cooldown_seconds=0)
    registry.record_failure("test", RuntimeError("boom"))
    assert registry.can_request("test")
    assert not registry.can_request("test")
    registry.record_success("test")
    assert registry.can_request("test")
