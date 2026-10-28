"""The credential in GARMIN_SECRET: a garminconnect token store."""

from __future__ import annotations

import base64
import binascii
import json
import os
import re
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

from garminconnect.client import Client as _DiClient
from garminconnect.exceptions import GarminConnectAuthenticationError

from .errors import GarminAuthError, GarminTokenExpired

SECRET_ENV = "GARMIN_SECRET"
WRITEBACK_ENV = "GARMIN_SECRET_WRITEBACK"

# garminconnect raises a bare message on a refused refresh; the status is only in its text.
_REFRESH_STATUS = re.compile(r"refresh failed: (\d{3})")

_REFRESH_FAILED = (
    "Token refresh failed: {exc}\n"
    "\n"
    "A 400 or 401 means Garmin refused the refresh token in GARMIN_SECRET: it has expired or been revoked. "
    "Mint a new one with python scripts/get_secret.py from a home connection, then replace GARMIN_SECRET in "
    "this profile's GitHub Environment and its .env.<profile>.local. A 403 is Garmin refusing this network, "
    "and the next run tries again.\n"
    "\n"
    "See 'Optional: the Garmin Connect token' under Setup in README.md."
)

NOT_A_SECRET = "GARMIN_SECRET is not a garminconnect token store"


class ConnectAuth(Protocol):
    kind: str

    def headers(self) -> dict[str, str]: ...

    def refresh(self) -> None: ...

    def state(self) -> dict[str, Any]: ...

    def notice(self) -> str | None: ...


def encode_secret(token_store: str) -> str:
    """GARMIN_SECRET for a garminconnect token store (the JSON of garmin_tokens.json)."""
    return base64.b64encode(token_store.encode()).decode()


def _decode(secret: str) -> Any:
    text = secret.strip()
    if not text.startswith(("{", "[")):
        try:
            text = base64.b64decode(text, validate=True).decode()
        except (binascii.Error, UnicodeDecodeError) as exc:
            raise ValueError(NOT_A_SECRET) from exc
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(NOT_A_SECRET) from exc


def open_auth(secret: str) -> ConnectAuth:
    """The credential GARMIN_SECRET holds, refreshed first when its access token is about to expire."""
    payload = _decode(secret)
    if isinstance(payload, dict) and payload.get("di_token"):
        return DiTokenAuth(payload)
    raise ValueError(NOT_A_SECRET)


def _iso(epoch: float | None) -> str | None:
    if epoch is None:
        return None
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat(timespec="seconds")


def jwt_expiry(token: str | None) -> float | None:
    """The `exp` claim of a JWT, unverified: only for reporting, as Garmin alone holds the signing key."""
    if not token:
        return None
    parts = token.split(".")
    if len(parts) < 2:
        return None
    try:
        claims = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
        return None
    exp = claims.get("exp") if isinstance(claims, dict) else None
    return float(exp) if isinstance(exp, int | float) and not isinstance(exp, bool) else None


def write_secret_to_env_file(path: Path, secret: str) -> None:
    """Replace the GARMIN_SECRET line of a dotenv file, or add one, owner-readable only."""
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    entry = f"{SECRET_ENV}={secret}"
    replaced = [entry if line.startswith(f"{SECRET_ENV}=") else line for line in lines]
    if entry not in replaced:
        replaced.append(entry)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write("\n".join(replaced) + "\n")
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def _write_back(secret: str) -> None:
    """A refreshed token outlives the process only where GARMIN_SECRET_WRITEBACK names the env file to keep it in."""
    target = os.environ.get(WRITEBACK_ENV, "").strip()
    if not target:
        return
    try:
        write_secret_to_env_file(Path(target).expanduser(), secret)
    except OSError as exc:
        print(f"Warning: the refreshed Garmin token could not be written to {target}: {exc.strerror}", file=sys.stderr)


class DiTokenAuth:
    """garminconnect's DI OAuth2 tokens from diauth.garmin.com: a bearer access token and the refresh token that renews it."""

    kind = "garminconnect"

    def __init__(self, tokens: dict[str, Any]) -> None:
        self._client = _DiClient()
        self._client.loads(json.dumps(tokens))
        self.refreshed = False
        self.rotated = False
        if self._client._token_expires_soon():
            self.refresh()

    def headers(self) -> dict[str, str]:
        return self._client.get_api_headers()

    def secret(self) -> str:
        return encode_secret(self._client.dumps())

    def refresh(self) -> None:
        before = self._client.di_refresh_token
        if not before:
            raise GarminTokenExpired(_REFRESH_FAILED.format(exc="GARMIN_SECRET holds no refresh token"))
        try:
            self._client._refresh_di_token()
        except GarminConnectAuthenticationError as exc:
            match = _REFRESH_STATUS.search(str(exc))
            status = int(match.group(1)) if match else None
            error = GarminTokenExpired if status in (400, 401) else GarminAuthError
            raise error(_REFRESH_FAILED.format(exc=exc)) from exc
        except Exception as exc:
            raise GarminAuthError(_REFRESH_FAILED.format(exc=f"{type(exc).__name__}: {exc}")) from exc
        self.refreshed = True
        self.rotated = self.rotated or self._client.di_refresh_token != before
        _write_back(self.secret())

    def notice(self) -> str | None:
        if not self.rotated or os.environ.get(WRITEBACK_ENV, "").strip():
            return None
        return (
            "Garmin issued a new refresh token this run, and GARMIN_SECRET still holds the old one. "
            "If Garmin revoked it, a later run reports Garmin Connect expired: see 'Connect token expiry' "
            "in docs/data-and-sync.md."
        )

    def state(self) -> dict[str, Any]:
        access_exp = jwt_expiry(self._client.di_token)
        refresh = self._client.di_refresh_token
        return {
            "kind": self.kind,
            "access": {
                "expiresAt": _iso(access_exp),
                "expired": access_exp is not None and access_exp <= time.time(),
            },
            "refresh": {"present": bool(refresh), "expiresAt": _iso(jwt_expiry(refresh))},
            "refreshedNow": self.refreshed,
            "refreshTokenRotated": self.rotated,
            "writeBack": bool(os.environ.get(WRITEBACK_ENV, "").strip()),
        }
