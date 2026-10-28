"""A stray print or a lost response shifts every answer after it onto the wrong request, unnoticed by the TypeScript side.

The `auth` operation answers from the tokens alone and an unexpired token is never refreshed, so a made-up one starts
the bridge without a request.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from garmin_tokens import di_secret, di_store, jwt

from garmin.auth import NOT_A_SECRET, encode_secret

_BRIDGE = Path(__file__).resolve().parents[1] / "garmin" / "sync_bridge.py"

_GUARDED = """
import runpy, socket, sys
from curl_cffi import requests as curl_requests

def refuse(*_args, **_kwargs):
    raise RuntimeError("the bridge reached for the network")

socket.socket.connect = refuse
socket.socket.connect_ex = refuse
socket.getaddrinfo = refuse
curl_requests.request = refuse
curl_requests.Session.request = refuse
sys.argv = [sys.argv[1]]
runpy.run_path(sys.argv[0], run_name="__main__")
"""


def _bridge(stdin: str, *, secret: str | None) -> subprocess.CompletedProcess:
    env = {key: value for key, value in os.environ.items() if not key.startswith(("GARMIN_", "GARTH_"))}
    if secret is not None:
        env["GARMIN_SECRET"] = secret
    return subprocess.run(
        [sys.executable, "-c", _GUARDED, str(_BRIDGE)],
        input=stdin,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )


def _responses(result: subprocess.CompletedProcess) -> list[dict]:
    return [json.loads(line) for line in result.stdout.splitlines()]


def test_one_response_per_request_in_order_until_stdin_closes():
    requests = "\n".join(
        [
            json.dumps({"op": "auth"}),
            "not json",
            "",  # a blank line is no request, and gets no response
            json.dumps({"op": "nope"}),
            json.dumps({"op": "get"}),  # no workoutId: fails before any request
        ]
    )

    result = _bridge(requests + "\n", secret=di_secret())

    assert result.returncode == 0, result.stderr
    auth, malformed, unknown, broken = _responses(result)
    assert auth["ok"] is True
    assert auth["kind"] == "garminconnect"
    assert malformed == {"ok": False, "error": "Malformed request"}
    assert unknown == {"ok": False, "error": "Unknown operation: 'nope'"}
    assert broken == {"ok": False, "error": "KeyError: 'workoutId'"}
    assert di_store()["di_token"] not in result.stdout + result.stderr
    assert "refresh-token-one" not in result.stdout + result.stderr


def test_auth_reports_a_garminconnect_token_by_its_expiries_alone():
    store = di_store(refresh=jwt(4_102_444_800, "refresh"))
    secret = encode_secret(json.dumps(store))

    result = _bridge(json.dumps({"op": "auth"}) + "\n", secret=secret)

    assert result.returncode == 0, result.stderr
    assert _responses(result) == [
        {
            "ok": True,
            "kind": "garminconnect",
            "access": {"expiresAt": "2100-01-01T00:00:00+00:00", "expired": False},
            "refresh": {"present": True, "expiresAt": "2100-01-01T00:00:00+00:00"},
            "refreshedNow": False,
            "refreshTokenRotated": False,
            "writeBack": False,
        }
    ]
    assert store["di_token"] not in result.stdout + result.stderr
    assert store["di_refresh_token"] not in result.stdout + result.stderr


@pytest.mark.parametrize("secret", ["not-a-real-token", "{}"])
def test_a_secret_that_is_no_credential_says_so_and_exits_3(secret):
    result = _bridge(json.dumps({"op": "auth"}) + "\n", secret=secret)

    assert result.returncode == 3
    assert _responses(result) == [{"ok": False, "error": NOT_A_SECRET}]


def test_without_a_secret_it_says_so_on_the_protocol_and_exits_2():
    result = _bridge(json.dumps({"op": "auth"}) + "\n", secret=None)

    assert result.returncode == 2
    assert _responses(result) == [{"ok": False, "error": "GARMIN_SECRET is not set"}]
