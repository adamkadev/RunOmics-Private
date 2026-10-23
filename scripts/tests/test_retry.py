import httpx
import pytest

from garmin.client import GarminAPIError
from garmin import retry as retry_mod
from garmin.retry import retry_transient


@pytest.fixture(autouse=True)
def pauses(monkeypatch):
    """Backoff pauses are real seconds: record them instead of waiting."""
    taken: list[float] = []
    monkeypatch.setattr(retry_mod.time, "sleep", taken.append)
    return taken


def test_passes_arguments_through():
    assert retry_transient(lambda a, *, b: (a, b), 1, b=2) == (1, 2)


@pytest.mark.parametrize(
    "error,expected",
    [(GarminAPIError(503, "url"), [2.0, 8.0, 32.0]), (GarminAPIError(429, "url"), [60.0, 60.0, 60.0])],
    ids=["5xx backs off", "429 waits out the rate limit"],
)
def test_the_backoff_is_bounded(pauses, error, expected):
    def failing():
        raise error

    with pytest.raises(GarminAPIError):
        retry_transient(failing)
    assert pauses == expected


def test_retries_429_until_success():
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise GarminAPIError(429, "url")
        return "ok"

    assert retry_transient(flaky) == "ok"
    assert calls["n"] == 3


def test_non_transient_4xx_raises_immediately():
    calls = {"n": 0}

    def notfound():
        calls["n"] += 1
        raise GarminAPIError(404, "url")

    with pytest.raises(GarminAPIError):
        retry_transient(notfound)
    assert calls["n"] == 1


def test_network_errors_exhaust_attempts_then_raise():
    calls = {"n": 0}

    def network():
        calls["n"] += 1
        raise httpx.ConnectError("boom")

    with pytest.raises(httpx.ConnectError):
        retry_transient(network)
    assert calls["n"] == 4  # initial try + 3 retries


def test_5xx_is_transient():
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] == 1:
            raise GarminAPIError(503, "url")
        return "ok"

    assert retry_transient(flaky) == "ok"
    assert calls["n"] == 2
