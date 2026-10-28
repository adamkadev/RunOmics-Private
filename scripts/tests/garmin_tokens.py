from __future__ import annotations

import base64
import json
import time

IN_2100 = 4_102_444_800
DI_CLIENT_ID = "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2"


def _segment(payload: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")


def jwt(exp: float, marker: str = "access") -> str:
    return ".".join([_segment({"alg": "RS256"}), _segment({"exp": int(exp), "client_id": DI_CLIENT_ID, "m": marker}), "sig"])


def di_store(*, access_exp: float = IN_2100, refresh: str | None = "refresh-token-one") -> dict:
    return {"di_token": jwt(access_exp), "di_refresh_token": refresh, "di_client_id": DI_CLIENT_ID}


def di_secret(**kwargs) -> str:
    return base64.b64encode(json.dumps(di_store(**kwargs)).encode()).decode()


def expired_di_secret(**kwargs) -> str:
    return di_secret(access_exp=time.time() - 60, **kwargs)


def garth_secret(*, expires_at: float = IN_2100, mfa_token: str | None = None) -> str:
    oauth1 = {"oauth_token": "test-oauth1-token", "oauth_token_secret": "test-oauth1-secret", "domain": "garmin.com"}
    if mfa_token:
        oauth1["mfa_token"] = mfa_token
    oauth2 = {
        "scope": "test",
        "jti": "test",
        "token_type": "Bearer",
        "access_token": "test-access",
        "refresh_token": "test-refresh",
        "expires_in": 3600,
        "expires_at": int(expires_at),
        "refresh_token_expires_in": 7200,
        "refresh_token_expires_at": IN_2100,
    }
    return base64.b64encode(json.dumps([oauth1, oauth2]).encode()).decode()
