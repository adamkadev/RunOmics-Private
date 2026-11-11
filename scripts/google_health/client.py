"""The Google Health API, read with the refresh token scripts/google_health_setup.sh mints for the owner."""

from __future__ import annotations

import os
import time
from collections.abc import Callable
from datetime import date, timedelta
from typing import Any

import httpx

TOKEN_URL = "https://oauth2.googleapis.com/token"
API_BASE = "https://health.googleapis.com/v4/users/me/dataTypes"
# Excludes a phone's own records, which can file a workout's heart rate as a resting one.
WEARABLES = "users/me/dataSourceFamilies/google-wearables"

_TIMEOUT = httpx.Timeout(60.0, connect=20.0)
_MAX_ATTEMPTS = 3
_BACKOFF_SECONDS = 4.0
# The longest civil range one steps roll-up may span.
_ROLLUP_MAX_DAYS = 90
_LIST_PAGE_SIZE = {"sleep": 25}
_DEFAULT_PAGE_SIZE = 1000


class GoogleHealthError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class GoogleHealthClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
        *,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._credentials = {"client_id": client_id, "client_secret": client_secret, "refresh_token": refresh_token}
        self._http = httpx.Client(timeout=_TIMEOUT, transport=transport)
        self._sleep = sleep
        self._token: str | None = None

    @classmethod
    def from_env(cls) -> GoogleHealthClient | None:
        values = [os.environ.get(f"GOOGLE_HEALTH_{name}", "").strip() for name in ("CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN")]
        return cls(*values) if all(values) else None

    def __enter__(self) -> GoogleHealthClient:
        return self

    def __exit__(self, *_: object) -> None:
        self._http.close()

    def list_points(self, data_type: str, field: str, start: date, end: date, *, wearables_only: bool = True) -> list[dict]:
        """Every data point whose `field` falls in [start, end), across all pages."""
        snake = data_type.replace("-", "_")
        params: dict[str, Any] = {
            "filter": f'{snake}.{field} >= "{start.isoformat()}" AND {snake}.{field} < "{end.isoformat()}"',
            "pageSize": _LIST_PAGE_SIZE.get(data_type, _DEFAULT_PAGE_SIZE),
        }
        if wearables_only:
            params["dataSourceFamily"] = WEARABLES
        points: list[dict] = []
        while True:
            page = self._request("GET", f"{API_BASE}/{data_type}/dataPoints", params=params)
            points += [p for p in page.get("dataPoints") or [] if isinstance(p, dict)]
            token = page.get("nextPageToken")
            if not token:
                return points
            params = {**params, "pageToken": token}

    def daily_steps(self, start: date, end: date) -> list[dict]:
        """One roll-up per local day in [start, end), from the wearables alone."""
        rows: list[dict] = []
        window_start = start
        while window_start < end:
            window_end = min(end, window_start + timedelta(days=_ROLLUP_MAX_DAYS))
            body: dict[str, Any] = {
                "range": {"start": _civil(window_start), "end": _civil(window_end)},
                "windowSizeDays": 1,
                "pageSize": _ROLLUP_MAX_DAYS,
                "dataSourceFamily": WEARABLES,
            }
            while True:
                page = self._request("POST", f"{API_BASE}/steps/dataPoints:dailyRollUp", json=body)
                rows += [r for r in page.get("rollupDataPoints") or [] if isinstance(r, dict)]
                token = page.get("nextPageToken")
                if not token:
                    break
                body = {**body, "pageToken": token}
            window_start = window_end
        return rows

    def _access_token(self) -> str:
        if self._token:
            return self._token
        response = self._send("POST", TOKEN_URL, data={**self._credentials, "grant_type": "refresh_token"})
        payload = _json(response)
        if response.status_code == 400 and payload.get("error") == "invalid_grant":
            raise GoogleHealthError(
                "Google refused the refresh token (invalid_grant): it was revoked, or went six months unused. "
                "Run scripts/google_health_setup.sh again.",
                400,
            )
        if response.status_code != 200 or not payload.get("access_token"):
            message = f"token refresh failed with HTTP {response.status_code}: {payload.get('error', '')}"
            raise GoogleHealthError(message, response.status_code)
        self._token = str(payload["access_token"])
        return self._token

    def _request(self, method: str, url: str, **kwargs: Any) -> dict:
        response = self._send(method, url, headers={"Authorization": f"Bearer {self._access_token()}"}, **kwargs)
        if response.status_code != 200:
            error = _json(response).get("error")
            detail = error.get("status", "") if isinstance(error, dict) else ""
            data_type = url.rsplit("/", 2)[-2]
            raise GoogleHealthError(f"{data_type} answered HTTP {response.status_code} {detail}".strip(), response.status_code)
        return _json(response)

    def _send(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                response = self._http.request(method, url, **kwargs)
            except httpx.TransportError:
                if attempt == _MAX_ATTEMPTS:
                    raise
            else:
                if (response.status_code != 429 and response.status_code < 500) or attempt == _MAX_ATTEMPTS:
                    return response
            self._sleep(_BACKOFF_SECONDS * attempt)
        raise AssertionError("unreachable")


def _civil(day: date) -> dict:
    return {"date": {"year": day.year, "month": day.month, "day": day.day}, "time": {"hours": 0, "minutes": 0, "seconds": 0}}


def _json(response: httpx.Response) -> dict:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}
