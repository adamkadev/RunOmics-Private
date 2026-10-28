import base64
import io
import json

import garminconnect
import pytest
from garmin_tokens import IN_2100, di_store, jwt

import get_secret


class _FakeGarmin:
    instances: list = []
    outcome: object = None
    tokens: dict = {}

    def __init__(self, email, password, prompt_mfa=None):
        self.email = email
        self.password = password
        self.prompt_mfa = prompt_mfa
        self.client = garminconnect.client.Client()
        _FakeGarmin.instances.append(self)

    def login(self, tokenstore=None):
        assert tokenstore is None
        if isinstance(_FakeGarmin.outcome, Exception):
            raise _FakeGarmin.outcome
        if _FakeGarmin.outcome == "mfa":
            assert self.prompt_mfa() == "123456"
        self.client.loads(json.dumps(_FakeGarmin.tokens))
        return None, None


@pytest.fixture
def login(monkeypatch):
    _FakeGarmin.instances = []
    _FakeGarmin.outcome = None
    _FakeGarmin.tokens = di_store(refresh="refresh-token-one")
    monkeypatch.setattr(garminconnect, "Garmin", _FakeGarmin)
    monkeypatch.setattr(get_secret.getpass, "getpass", lambda _prompt, stream=None: "hunter2")
    monkeypatch.setenv("GARMINTOKENS", "/somewhere/else")

    def run(stdin="me@example.com\n"):
        monkeypatch.setattr(get_secret.sys, "stdin", io.StringIO(stdin))
        return get_secret.main()

    return run


def test_stdout_is_the_secret_alone_and_it_holds_the_token_store(login, capsys):
    assert login() == 0

    out, err = capsys.readouterr()
    assert out.count("\n") == 1
    assert json.loads(base64.b64decode(out.strip())) == _FakeGarmin.tokens
    assert out.strip() not in err
    assert "hunter2" not in out + err
    assert _FakeGarmin.tokens["di_token"] not in err
    assert "access token expires : 2100-01-01T00:00:00+00:00" in err
    assert "refresh token        : present" in err


def test_it_signs_in_with_the_typed_credentials_and_never_a_stored_token(login, monkeypatch):
    login()

    (garmin,) = _FakeGarmin.instances
    assert (garmin.email, garmin.password) == ("me@example.com", "hunter2")
    assert "GARMINTOKENS" not in get_secret.os.environ


def test_an_mfa_code_is_read_from_stdin_when_garmin_asks(login, capsys):
    _FakeGarmin.outcome = "mfa"

    assert login("me@example.com\n123456\n") == 0

    assert "MFA code" in capsys.readouterr().err


def test_a_rate_limited_sign_in_prints_no_secret_and_says_to_wait(login, capsys):
    _FakeGarmin.outcome = garminconnect.GarminConnectTooManyRequestsError("429")

    assert login() == 1

    out, err = capsys.readouterr()
    assert out == ""
    assert "429" in err


def test_a_refused_sign_in_prints_no_secret(login, capsys):
    _FakeGarmin.outcome = garminconnect.GarminConnectAuthenticationError("bad password")

    assert login() == 1

    out, err = capsys.readouterr()
    assert out == ""
    assert "bad password" in err


def test_a_web_cookie_sign_in_cannot_be_stored_and_prints_no_secret(login, capsys, monkeypatch):
    def cookie_only(self, tokenstore=None):
        self.client.jwt_web = "cookie"
        return None, None

    monkeypatch.setattr(_FakeGarmin, "login", cookie_only)

    assert login() == 1

    out, err = capsys.readouterr()
    assert out == ""
    assert "cannot be stored" in err


def test_a_missing_refresh_token_is_said_plainly(login, capsys):
    _FakeGarmin.tokens = {**di_store(), "di_refresh_token": None, "di_token": jwt(IN_2100)}

    assert login() == 0

    assert "MISSING" in capsys.readouterr().err


def test_without_an_email_nothing_is_sent(login, capsys):
    assert login("\n") == 1

    assert _FakeGarmin.instances == []
    assert capsys.readouterr().out == ""
