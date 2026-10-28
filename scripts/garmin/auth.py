"""The credential in GARMIN_SECRET: a garminconnect token store, or a garth token until the secrets are rotated."""

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
from urllib.parse import urlencode

import httpx
from garminconnect.client import Client as _DiClient
from garminconnect.exceptions import GarminConnectAuthenticationError
from oauthlib.oauth1 import Client as _OAuth1Signer

from .errors import GarminAuthError, GarminTokenExpired

SECRET_ENV = "GARMIN_SECRET"
WRITEBACK_ENV = "GARMIN_SECRET_WRITEBACK"

_TIMEOUT = httpx.Timeout(60.0, connect=30.0)
_LEGACY_USER_AGENT = "Mozilla/5.0 (RunOmics/1.0)"
# garminconnect raises a bare message on a refused refresh; the status is only in its text.
_REFRESH_STATUS = re.compile(r"refresh failed: (\d{3})")

_REFRESH_FAILED = (
    "Token refresh failed: {exc}\n"
    "\n"
    "A 400 or 401 means Garmin refused the refresh token in GARMIN_SECRET: it has expired or been revoked. "
    "Mint a new one with python scripts/get_secret.py from a home connection, then replace GARMIN_SECRET in "
    "this profile's GitHub Environment and its .env.<profile>.local. A 403 is Garmin refusing this network "
    "(as when WARP is down), and the next run tries again.\n"
    "\n"
    "See 'Optional: the Garmin Connect token' under Setup in README.md."
)

_LEGACY_REFRESH_FAILED = (
    "Token refresh failed: {exc}\n"
    "\n"
    "GARMIN_SECRET still holds a garth token, and a 401 means its OAuth1 token has expired: garth tokens "
    "can no longer be minted or renewed. Mint a garminconnect token with python scripts/get_secret.py from "
    "a home connection and put it in GARMIN_SECRET.\n"
    "\n"
    "See 'Optional: the Garmin Connect token' under Setup in README.md."
)

NOT_A_SECRET = "GARMIN_SECRET is neither a garminconnect token store nor a garth token"


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
    if isinstance(payload, list) and len(payload) == 2 and all(isinstance(part, dict) for part in payload):
        return LegacyGarthAuth(payload[0], payload[1])
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


_CONSUMER_KEY_ENV = "GARMIN_OAUTH_CONSUMER_KEY"
_CONSUMER_SECRET_ENV = "GARMIN_OAUTH_CONSUMER_SECRET"

# Garmin's own Android client pair, the same for every user and shipped in Garmin's app: not a secret.
# Only a garth token needs it, and only until GARMIN_SECRET is rotated to a garminconnect token.
_OAUTH_CONSUMER = {
    "consumer_key": "fc3e99d2-118c-44b8-8ae3-03370dde24c0",
    "consumer_secret": "E08WAR897WEy2knn7aFBrvegVAf0AFdWBBF",
}


def oauth_consumer() -> dict[str, str]:
    """The environment's pair, for the day Garmin rotates it, else the shipped one."""
    key = os.environ.get(_CONSUMER_KEY_ENV, "").strip()
    secret = os.environ.get(_CONSUMER_SECRET_ENV, "").strip()
    if key and secret:
        return {"consumer_key": key, "consumer_secret": secret}
    return dict(_OAUTH_CONSUMER)


class LegacyGarthAuth:
    """A garth token: an OAuth1 token exchanged for a fresh OAuth2 token each run, signed as garth signed it."""

    kind = "garth"

    def __init__(self, oauth1: dict[str, Any], oauth2: dict[str, Any]) -> None:
        if not oauth1.get("oauth_token") or not oauth1.get("oauth_token_secret"):
            raise ValueError(NOT_A_SECRET)
        self._oauth1 = oauth1
        self._oauth2 = oauth2
        self.refreshed = False
        if not oauth2.get("access_token") or float(oauth2.get("expires_at") or 0) <= time.time():
            self.refresh()

    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._oauth2.get('access_token', '')}",
            "NK": "NT",
            "User-Agent": _LEGACY_USER_AGENT,
        }

    def refresh(self) -> None:
        domain = self._oauth1.get("domain") or "garmin.com"
        url = f"https://connectapi.{domain}/oauth-service/oauth/exchange/user/2.0"
        form = {"mfa_token": self._oauth1["mfa_token"]} if self._oauth1.get("mfa_token") else {}
        consumer = oauth_consumer()
        signer = _OAuth1Signer(
            consumer["consumer_key"],
            client_secret=consumer["consumer_secret"],
            resource_owner_key=self._oauth1["oauth_token"],
            resource_owner_secret=self._oauth1["oauth_token_secret"],
        )
        _, headers, body = signer.sign(
            url,
            http_method="POST",
            body=urlencode(form),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        headers["User-Agent"] = "com.garmin.android.apps.connectmobile"
        try:
            resp = httpx.post(url, headers=headers, content=body or b"", timeout=_TIMEOUT)
        except httpx.HTTPError as exc:
            raise GarminAuthError(_LEGACY_REFRESH_FAILED.format(exc=f"{type(exc).__name__}: {exc}")) from exc
        if resp.status_code >= 400:
            error = GarminTokenExpired if resp.status_code == 401 else GarminAuthError
            raise error(_LEGACY_REFRESH_FAILED.format(exc=f"HTTP {resp.status_code} from {url}"))
        try:
            token = resp.json()
            now = time.time()
            token["expires_at"] = int(now + float(token["expires_in"]))
            if "refresh_token_expires_in" in token:
                token["refresh_token_expires_at"] = int(now + float(token["refresh_token_expires_in"]))
        except (ValueError, KeyError, TypeError) as exc:
            raise GarminAuthError(_LEGACY_REFRESH_FAILED.format(exc="the token exchange answered no token")) from exc
        self._oauth2 = token
        self.refreshed = True

    def notice(self) -> str | None:
        return (
            "GARMIN_SECRET still holds a garth token, which cannot be renewed once its OAuth1 token expires. "
            "Mint a garminconnect token with python scripts/get_secret.py (README.md, 'Optional: the Garmin Connect token')."
        )

    def state(self) -> dict[str, Any]:
        expires_at = self._oauth2.get("expires_at")
        refresh_at = self._oauth2.get("refresh_token_expires_at")
        return {
            "kind": self.kind,
            "oauth1": {"present": True, "expiresAt": None},
            "oauth2": {
                "expiresAt": _iso(expires_at),
                "expired": expires_at is not None and expires_at <= time.time(),
                "refreshTokenExpiresAt": _iso(refresh_at),
                "refreshExpired": refresh_at is not None and refresh_at <= time.time(),
            },
            "refreshedNow": self.refreshed,
        }
