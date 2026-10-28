import base64
import json
import os
import stat
from types import SimpleNamespace

import pytest
from garmin_tokens import DI_CLIENT_ID, IN_2100, di_secret, di_store, expired_di_secret, jwt
from garminconnect.client import Client as DiClient

from garmin import auth
from garmin.auth import DiTokenAuth, encode_secret, open_auth, write_secret_to_env_file
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
    env_file = tmp_path / ".env.profile.local"
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
    monkeypatch.setenv(auth.WRITEBACK_ENV, str(tmp_path / "missing-dir" / ".env.profile.local"))

    credential = open_auth(expired_di_secret())

    err = capsys.readouterr().err
    assert "could not be written" in err
    assert credential.secret() not in err


def test_the_env_file_gains_a_line_when_it_had_none(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("A=1\n")

    write_secret_to_env_file(env_file, "abc")

    assert env_file.read_text() == "A=1\nGARMIN_SECRET=abc\n"


@pytest.mark.parametrize(
    "secret",
    [
        "not-a-real-token",
        "eyJub3QiOiAianNvbiJ9",
        base64.b64encode(b"[1, 2, 3]").decode(),
        "{}",
        base64.b64encode(json.dumps([{"oauth_token": "t", "oauth_token_secret": "s"}, {"access_token": "a"}]).encode()).decode(),
    ],
)
def test_anything_else_is_refused_without_repeating_it(secret):
    with pytest.raises(ValueError) as raised:
        open_auth(secret)

    assert secret not in str(raised.value)


def test_a_rotated_refresh_token_nothing_stored_is_flagged(diauth):
    assert "still holds the old one" in open_auth(expired_di_secret()).notice()


def test_a_rotated_refresh_token_that_was_written_back_needs_nothing(diauth, tmp_path, monkeypatch):
    monkeypatch.setenv(auth.WRITEBACK_ENV, str(tmp_path / ".env"))

    assert open_auth(expired_di_secret()).notice() is None


def test_an_unrefreshed_token_needs_nothing(diauth):
    assert open_auth(di_secret()).notice() is None
