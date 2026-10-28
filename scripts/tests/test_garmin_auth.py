import base64
import json
import os
import stat
import time
from types import SimpleNamespace
from urllib.parse import parse_qsl

import httpx
import pytest
from garmin_tokens import DI_CLIENT_ID, IN_2100, di_secret, di_store, expired_di_secret, garth_secret, jwt
from garminconnect.client import Client as DiClient
from oauthlib.common import Request
from oauthlib.oauth1.rfc5849 import signature

from garmin import auth
from garmin.auth import DiTokenAuth, LegacyGarthAuth, encode_secret, open_auth, write_secret_to_env_file
from garmin.errors import GarminAuthError, GarminTokenExpired


@pytest.fixture
def diauth(monkeypatch):
    calls: list[dict] = []
    answer = {"status": 200, "body": {"access_token": jwt(IN_2100, "renewed"), "refresh_token": "refresh-token-two"}}

    def post(_self, url, **kwargs):
        calls.append({"url": url, **kwargs})
        if isinstance(answer.get("raise"), Exception):
            raise answer["raise"]
        status = answer["status"]
        return SimpleNamespace(ok=status < 400, status_code=status, json=lambda: answer["body"], text="")

    monkeypatch.setattr(DiClient, "_http_post", post)
    monkeypatch.delenv(auth.WRITEBACK_ENV, raising=False)
    return SimpleNamespace(calls=calls, answer=answer)


@pytest.fixture
def exchange(monkeypatch):
    calls: list[dict] = []
    answer = {"status": 200, "body": {"access_token": "exchanged-access", "expires_in": 3600, "refresh_token_expires_in": 7200}}

    def post(url, **kwargs):
        calls.append({"url": url, **kwargs})
        if isinstance(answer.get("raise"), Exception):
            raise answer["raise"]
        return httpx.Response(answer["status"], json=answer["body"], request=httpx.Request("POST", url))

    monkeypatch.setattr(auth.httpx, "post", post)
    monkeypatch.delenv("GARMIN_OAUTH_CONSUMER_KEY", raising=False)
    monkeypatch.delenv("GARMIN_OAUTH_CONSUMER_SECRET", raising=False)
    return SimpleNamespace(calls=calls, answer=answer)


def test_garminconnect_still_has_the_hooks_the_auth_relies_on():
    for name in ("loads", "dumps", "get_api_headers", "_token_expires_soon", "_refresh_di_token", "_http_post"):
        assert callable(getattr(DiClient, name, None)), name


def test_an_unexpired_token_store_loads_without_a_request(diauth):
    credential = open_auth(di_secret())

    assert isinstance(credential, DiTokenAuth)
    assert diauth.calls == []
    assert credential.headers()["Authorization"] == f"Bearer {di_store()['di_token']}"
    assert credential.headers()["User-Agent"].startswith("GCM-Android")


def test_the_raw_token_store_json_is_accepted_as_well(diauth):
    assert isinstance(open_auth(json.dumps(di_store())), DiTokenAuth)


def test_an_expiring_access_token_is_refreshed_at_sign_in_with_the_stored_refresh_token(diauth):
    credential = open_auth(expired_di_secret())

    assert len(diauth.calls) == 1
    form = diauth.calls[0]["data"]
    assert form == {"grant_type": "refresh_token", "client_id": DI_CLIENT_ID, "refresh_token": "refresh-token-one"}
    assert diauth.calls[0]["headers"]["Authorization"] == "Basic " + base64.b64encode(f"{DI_CLIENT_ID}:".encode()).decode()
    assert credential.headers()["Authorization"] == f"Bearer {jwt(IN_2100, 'renewed')}"
    state = credential.state()
    assert state["refreshedNow"] is True
    assert state["refreshTokenRotated"] is True


def test_the_refreshed_secret_round_trips_through_open_auth(diauth):
    credential = open_auth(expired_di_secret())

    reopened = open_auth(credential.secret())

    assert reopened.headers()["Authorization"] == credential.headers()["Authorization"]
    assert json.loads(base64.b64decode(credential.secret()))["di_refresh_token"] == "refresh-token-two"


def test_a_refresh_without_a_new_refresh_token_keeps_the_old_one(diauth):
    diauth.answer["body"] = {"access_token": jwt(IN_2100, "renewed")}

    credential = open_auth(expired_di_secret())

    assert credential.state()["refreshTokenRotated"] is False
    assert json.loads(base64.b64decode(credential.secret()))["di_refresh_token"] == "refresh-token-one"


@pytest.mark.parametrize("status", [400, 401])
def test_a_refused_refresh_token_is_an_expired_token(diauth, status):
    diauth.answer["status"] = status

    with pytest.raises(GarminTokenExpired, match="get_secret.py"):
        open_auth(expired_di_secret())


@pytest.mark.parametrize("status", [403, 429, 503])
def test_any_other_refused_refresh_is_not_taken_for_expiry(diauth, status):
    diauth.answer["status"] = status

    with pytest.raises(GarminAuthError) as raised:
        open_auth(expired_di_secret())

    assert not isinstance(raised.value, GarminTokenExpired)


def test_a_network_failure_during_refresh_is_not_taken_for_expiry(diauth):
    diauth.answer["raise"] = ConnectionResetError("connection reset")

    with pytest.raises(GarminAuthError) as raised:
        open_auth(expired_di_secret())

    assert not isinstance(raised.value, GarminTokenExpired)


def test_a_token_store_without_a_refresh_token_is_expired_once_its_access_token_is(diauth):
    with pytest.raises(GarminTokenExpired):
        open_auth(expired_di_secret(refresh=None))

    assert diauth.calls == []


def test_the_state_reports_expiries_and_never_the_tokens(diauth):
    store = di_store(refresh=jwt(IN_2100, "refresh"))
    credential = open_auth(encode_secret(json.dumps(store)))

    state = credential.state()

    assert state == {
        "kind": "garminconnect",
        "access": {"expiresAt": "2100-01-01T00:00:00+00:00", "expired": False},
        "refresh": {"present": True, "expiresAt": "2100-01-01T00:00:00+00:00"},
        "refreshedNow": False,
        "refreshTokenRotated": False,
        "writeBack": False,
    }
    assert store["di_token"] not in json.dumps(state)
    assert store["di_refresh_token"] not in json.dumps(state)


def test_an_opaque_refresh_token_has_no_readable_expiry(diauth):
    assert open_auth(di_secret()).state()["refresh"] == {"present": True, "expiresAt": None}


def test_a_refreshed_token_is_written_back_to_the_named_env_file(diauth, tmp_path, monkeypatch):
    env_file = tmp_path / ".env.adam.local"
    env_file.write_text("GARMIN_PERSONAL_API_KEY=key\nGARMIN_SECRET=old\nRUNOMICS_DATA_DIR=../data\n")
    monkeypatch.setenv(auth.WRITEBACK_ENV, str(env_file))

    credential = open_auth(expired_di_secret())

    assert env_file.read_text() == (
        f"GARMIN_PERSONAL_API_KEY=key\nGARMIN_SECRET={credential.secret()}\nRUNOMICS_DATA_DIR=../data\n"
    )
    if os.name == "posix":
        assert stat.S_IMODE(env_file.stat().st_mode) == 0o600
    assert credential.state()["writeBack"] is True


def test_without_a_write_back_file_nothing_is_written(diauth, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    open_auth(expired_di_secret())

    assert list(tmp_path.iterdir()) == []


def test_a_write_back_that_fails_warns_without_the_token_and_keeps_the_run(diauth, tmp_path, monkeypatch, capsys):
    monkeypatch.setenv(auth.WRITEBACK_ENV, str(tmp_path / "missing-dir" / ".env.adam.local"))

    credential = open_auth(expired_di_secret())

    err = capsys.readouterr().err
    assert "could not be written" in err
    assert credential.secret() not in err


def test_the_env_file_gains_a_line_when_it_had_none(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("A=1\n")

    write_secret_to_env_file(env_file, "abc")

    assert env_file.read_text() == "A=1\nGARMIN_SECRET=abc\n"


@pytest.mark.parametrize("secret", ["not-a-real-token", "eyJub3QiOiAianNvbiJ9", base64.b64encode(b"[1, 2, 3]").decode(), "{}"])
def test_anything_else_is_refused_without_repeating_it(secret):
    with pytest.raises(ValueError) as raised:
        open_auth(secret)

    assert secret not in str(raised.value)


def test_an_unexpired_garth_token_loads_without_a_request(exchange):
    credential = open_auth(garth_secret())

    assert isinstance(credential, LegacyGarthAuth)
    assert exchange.calls == []
    assert credential.headers()["Authorization"] == "Bearer test-access"


def test_an_expired_garth_token_is_exchanged_with_a_valid_oauth1_signature(exchange):
    credential = open_auth(garth_secret(expires_at=time.time() - 60))

    (call,) = exchange.calls
    assert call["url"] == "https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0"
    oauth = dict(signature.collect_parameters(headers=call["headers"], exclude_oauth_signature=False))
    request = Request(call["url"], "POST", call["content"] or "", call["headers"])
    request.params = signature.collect_parameters(headers=call["headers"], body=call["content"] or "")
    request.signature = oauth["oauth_signature"]
    assert oauth["oauth_consumer_key"] == auth._OAUTH_CONSUMER["consumer_key"]
    assert oauth["oauth_token"] == "test-oauth1-token"
    assert oauth["oauth_signature_method"] == "HMAC-SHA1"
    assert signature.verify_hmac_sha1(request, auth._OAUTH_CONSUMER["consumer_secret"], "test-oauth1-secret")
    assert not signature.verify_hmac_sha1(request, auth._OAUTH_CONSUMER["consumer_secret"], "another-secret")
    assert credential.headers()["Authorization"] == "Bearer exchanged-access"
    assert credential.state()["oauth2"]["expired"] is False


def test_a_garth_mfa_token_travels_in_the_signed_form(exchange):
    open_auth(garth_secret(expires_at=0, mfa_token="test-mfa"))

    (call,) = exchange.calls
    assert dict(parse_qsl(call["content"])) == {"mfa_token": "test-mfa"}


def test_the_environment_consumer_pair_replaces_the_shipped_one(exchange, monkeypatch):
    monkeypatch.setenv("GARMIN_OAUTH_CONSUMER_KEY", "env-key")
    monkeypatch.setenv("GARMIN_OAUTH_CONSUMER_SECRET", "env-secret")

    open_auth(garth_secret(expires_at=0))

    assert 'oauth_consumer_key="env-key"' in exchange.calls[0]["headers"]["Authorization"]


def test_half_a_consumer_pair_falls_back_to_the_shipped_one(monkeypatch):
    monkeypatch.setenv("GARMIN_OAUTH_CONSUMER_KEY", "env-key")
    monkeypatch.delenv("GARMIN_OAUTH_CONSUMER_SECRET", raising=False)

    assert auth.oauth_consumer() == auth._OAUTH_CONSUMER


def test_a_refused_garth_exchange_is_an_expired_token(exchange):
    exchange.answer["status"] = 401

    with pytest.raises(GarminTokenExpired, match="garth token"):
        open_auth(garth_secret(expires_at=0))


@pytest.mark.parametrize("failure", [403, 503, httpx.ConnectError("reset")], ids=["cloudflare-403", "garmin-503", "network"])
def test_any_other_garth_exchange_failure_is_not_taken_for_expiry(exchange, failure):
    if isinstance(failure, Exception):
        exchange.answer["raise"] = failure
    else:
        exchange.answer["status"] = failure

    with pytest.raises(GarminAuthError) as raised:
        open_auth(garth_secret(expires_at=0))

    assert not isinstance(raised.value, GarminTokenExpired)


def test_the_garth_state_keeps_its_shape_and_never_the_tokens(exchange):
    state = open_auth(garth_secret()).state()

    assert state == {
        "kind": "garth",
        "oauth1": {"present": True, "expiresAt": None},
        "oauth2": {
            "expiresAt": "2100-01-01T00:00:00+00:00",
            "expired": False,
            "refreshTokenExpiresAt": "2100-01-01T00:00:00+00:00",
            "refreshExpired": False,
        },
        "refreshedNow": False,
    }
    assert "test-access" not in json.dumps(state)


def test_a_garth_token_always_asks_to_be_replaced(exchange):
    assert "get_secret.py" in open_auth(garth_secret()).notice()


def test_a_rotated_refresh_token_nothing_stored_is_flagged(diauth):
    assert "still holds the old one" in open_auth(expired_di_secret()).notice()


def test_a_rotated_refresh_token_that_was_written_back_needs_nothing(diauth, tmp_path, monkeypatch):
    monkeypatch.setenv(auth.WRITEBACK_ENV, str(tmp_path / ".env"))

    assert open_auth(expired_di_secret()).notice() is None


def test_an_unrefreshed_token_needs_nothing(diauth):
    assert open_auth(di_secret()).notice() is None
