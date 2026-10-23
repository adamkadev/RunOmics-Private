"""A stray print or a lost response shifts every answer after it onto the wrong request, unnoticed by the TypeScript side.

The `auth` operation answers from the tokens alone and an unexpired token is never refreshed, so a made-up one starts
the bridge without a request.
"""

import base64
import json
import os
import subprocess
import sys
from pathlib import Path

_BRIDGE = Path(__file__).resolve().parents[1] / "garmin" / "sync_bridge.py"
_IN_2100 = 4_102_444_800  # epoch seconds, 2100-01-01

_GUARDED = """
import runpy, socket, sys

def refuse(*_args, **_kwargs):
    raise RuntimeError("the bridge reached for the network")

socket.socket.connect = refuse
socket.socket.connect_ex = refuse
socket.getaddrinfo = refuse
sys.argv = [sys.argv[1]]
runpy.run_path(sys.argv[0], run_name="__main__")
"""


def _made_up_secret() -> str:
    """GARMIN_SECRET's shape - garth's dump of both tokens - holding nothing real."""
    oauth1 = {"oauth_token": "test-token", "oauth_token_secret": "test-secret", "domain": "garmin.com"}
    oauth2 = {
        "scope": "test",
        "jti": "test",
        "token_type": "Bearer",
        "access_token": "test-access",
        "refresh_token": "test-refresh",
        "expires_in": 3600,
        "expires_at": _IN_2100,
        "refresh_token_expires_in": 7200,
        "refresh_token_expires_at": _IN_2100,
    }
    return base64.b64encode(json.dumps([oauth1, oauth2]).encode()).decode()


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

    result = _bridge(requests + "\n", secret=_made_up_secret())

    assert result.returncode == 0, result.stderr
    auth, malformed, unknown, broken = _responses(result)
    assert auth["ok"] is True
    assert auth["oauth1"]["present"] is True
    assert auth["oauth2"] == {
        "expiresAt": "2100-01-01T00:00:00+00:00",
        "expired": False,
        "refreshTokenExpiresAt": "2100-01-01T00:00:00+00:00",
        "refreshExpired": False,
    }
    assert malformed == {"ok": False, "error": "Malformed request"}
    assert unknown == {"ok": False, "error": "Unknown operation: 'nope'"}
    assert broken == {"ok": False, "error": "KeyError: 'workoutId'"}
    # The auth report describes the tokens; it must never carry them.
    assert "test-access" not in result.stdout + result.stderr
    assert "test-secret" not in result.stdout + result.stderr


def test_without_a_secret_it_says_so_on_the_protocol_and_exits_2():
    result = _bridge(json.dumps({"op": "auth"}) + "\n", secret=None)

    assert result.returncode == 2
    assert _responses(result) == [{"ok": False, "error": "GARMIN_SECRET is not set"}]
