from types import SimpleNamespace

import garth
import pytest
import requests
from garth.exc import GarthHTTPError

from garmin import client as garmin_client
from garmin.client import GarminAuthError, GarminClient, GarminTokenExpired


def _http_error(status: int) -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status
    return requests.HTTPError(f"{status} Client Error", response=response)


@pytest.fixture
def refresh(monkeypatch):
    outcome: dict[str, Exception] = {}

    def refresh_oauth2():
        raise outcome["error"]

    monkeypatch.setattr(garth.client, "loads", lambda _secret: None)
    monkeypatch.setattr(garth.client, "oauth2_token", SimpleNamespace(expired=True), raising=False)
    monkeypatch.setattr(garth.client, "refresh_oauth2", refresh_oauth2)
    monkeypatch.setattr(garmin_client, "_seed_oauth_consumer", lambda: None)
    return outcome


@pytest.mark.parametrize(
    "error",
    [_http_error(401), GarthHTTPError(msg="Error in request", error=_http_error(401))],
    ids=["requests", "garth"],
)
def test_a_refused_token_exchange_is_an_expired_token(refresh, error):
    refresh["error"] = error

    with pytest.raises(GarminTokenExpired, match="GARMIN_SECRET has most likely expired"):
        GarminClient("secret")


@pytest.mark.parametrize(
    "error",
    [_http_error(403), _http_error(503), requests.ConnectionError("connection reset"), AssertionError("no OAuth1 token")],
    ids=["cloudflare-403", "garmin-503", "network", "no-oauth1"],
)
def test_any_other_refresh_failure_is_not_taken_for_expiry(refresh, error):
    refresh["error"] = error

    with pytest.raises(GarminAuthError) as raised:
        GarminClient("secret")

    assert not isinstance(raised.value, GarminTokenExpired)


def test_an_expired_token_is_still_an_auth_error_for_every_older_caller():
    assert issubclass(GarminTokenExpired, GarminAuthError)


def test_a_401_mid_run_whose_refresh_is_refused_is_an_expired_token(monkeypatch):
    client = object.__new__(GarminClient)
    client._http = SimpleNamespace(request=lambda *_args, **_kwargs: SimpleNamespace(status_code=401))
    monkeypatch.setattr(garth.client, "oauth2_token", "Bearer x", raising=False)

    def refused():
        raise _http_error(401)

    monkeypatch.setattr(garth.client, "refresh_oauth2", refused)

    with pytest.raises(GarminTokenExpired):
        client._get("https://example.test/activity")
