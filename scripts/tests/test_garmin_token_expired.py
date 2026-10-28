from types import SimpleNamespace

import pytest
from garmin_tokens import expired_di_secret
from garminconnect.client import Client as DiClient

from garmin.client import GarminAPIError, GarminAuthError, GarminClient, GarminTokenExpired


class _Credential:
    kind = "test"

    def __init__(self, refresh_error=None):
        self.refresh_error = refresh_error
        self.token = "first"

    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def refresh(self):
        if self.refresh_error:
            raise self.refresh_error
        self.token = "second"

    def state(self):
        return {}


def _client_over(credential, statuses):
    client = object.__new__(GarminClient)
    client._auth = credential
    sent = []

    def request(method, url, headers=None, **_kwargs):
        sent.append(headers["Authorization"])
        return SimpleNamespace(status_code=statuses.pop(0))

    client._http = SimpleNamespace(request=request)
    return client, sent


def test_a_401_mid_run_refreshes_once_and_retries_with_the_new_token():
    client, sent = _client_over(_Credential(), [401, 200])

    assert client._get("https://example.test/activity").status_code == 200
    assert sent == ["Bearer first", "Bearer second"]


def test_a_401_mid_run_whose_refresh_is_refused_is_an_expired_token():
    client, _ = _client_over(_Credential(GarminTokenExpired("refused")), [401])

    with pytest.raises(GarminTokenExpired):
        client._get("https://example.test/activity")


def test_a_401_after_a_good_refresh_is_an_api_error():
    client, _ = _client_over(_Credential(), [401, 401])

    with pytest.raises(GarminAPIError) as raised:
        client._get("https://example.test/activity")

    assert raised.value.status_code == 401


def test_a_request_header_overrides_the_credential_for_that_request_only():
    client, _ = _client_over(_Credential(), [200])
    seen = {}

    def request(_method, _url, headers=None, **_kwargs):
        seen.update(headers)
        return SimpleNamespace(status_code=200)

    client._http = SimpleNamespace(request=request)

    client._get("https://example.test/file", headers={"Accept": "*/*"})

    assert seen == {"Authorization": "Bearer first", "Accept": "*/*"}


def test_a_refused_refresh_at_sign_in_is_an_expired_token(monkeypatch):
    monkeypatch.setattr(
        DiClient, "_http_post", lambda _self, _url, **_kwargs: SimpleNamespace(ok=False, status_code=400, text="")
    )

    with pytest.raises(GarminTokenExpired, match="GARMIN_SECRET"):
        GarminClient(expired_di_secret())


def test_an_expired_token_is_still_an_auth_error_for_every_older_caller():
    assert issubclass(GarminTokenExpired, GarminAuthError)
