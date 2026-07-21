from __future__ import annotations

import io
import os
import zipfile
from typing import Any

import garth
import httpx

os.environ.setdefault("GARTH_TELEMETRY_ENABLED", "false")

_CONNECT_API = "https://connectapi.garmin.com"
_TIMEOUT = httpx.Timeout(120.0, connect=30.0)
_USER_AGENT = "Mozilla/5.0 (RunOmics/1.0)"


class GarminAuthError(Exception):
    pass


class GarminAPIError(Exception):
    def __init__(self, status_code: int, url: str) -> None:
        super().__init__(f"HTTP {status_code} from {url}")
        self.status_code = status_code


class GarminClient:
    def __init__(self, secret_string: str) -> None:
        garth.client.loads(secret_string)

        if garth.client.oauth2_token.expired:
            try:
                garth.client.refresh_oauth2()
            except Exception as exc:
                raise GarminAuthError(f"Token refresh failed: {exc}") from exc

        self._base = _CONNECT_API
        self._http = httpx.Client(timeout=_TIMEOUT)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": str(garth.client.oauth2_token),
            "NK": "NT",
            "User-Agent": _USER_AGENT,
        }

    def _get(self, url: str, **kwargs: Any) -> httpx.Response:
        resp = self._http.get(url, headers=self._headers(), **kwargs)

        if resp.status_code == 401:
            garth.client.refresh_oauth2()
            resp = self._http.get(url, headers=self._headers(), **kwargs)

        if resp.status_code >= 400:
            raise GarminAPIError(resp.status_code, url)

        return resp

    def get_activities(
        self,
        start: int = 0,
        limit: int = 100,
        *,
        running_only: bool = True,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"start": start, "limit": limit}
        if running_only:
            params["activityType"] = "running"
        return self._get(
            f"{self._base}/activitylist-service/activities/search/activities",
            params=params,
        ).json()

    def get_all_activity_ids(self, *, running_only: bool = True) -> list[str]:
        ids: list[str] = []
        start = 0
        limit = 100

        while True:
            batch = self.get_activities(start=start, limit=limit, running_only=running_only)
            if not batch:
                break
            ids.extend(str(a["activityId"]) for a in batch)
            print(f"  Fetched {len(ids)} activity IDs...", end="\r", flush=True)
            if len(batch) < limit:
                break
            start += limit

        print(f"  Found {len(ids)} total activities on Garmin.       ")
        return ids

    def get_activity_detail(self, activity_id: str) -> dict[str, Any]:
        return self._get(
            f"{self._base}/activity-service/activity/{activity_id}"
        ).json()

    def get_hr_zones(self, activity_id: str) -> list[dict[str, Any]]:
        try:
            return self._get(
                f"{self._base}/activity-service/activity/{activity_id}/hrTimeInZones"
            ).json()
        except GarminAPIError as exc:
            if exc.status_code == 429:
                raise
            return []

    def get_activity_gear(self, activity_id: str) -> list[dict[str, Any]]:
        try:
            return self._get(
                f"{self._base}/gear-service/gear/filterGear",
                params={"activityId": activity_id},
            ).json()
        except GarminAPIError as exc:
            if exc.status_code == 429:
                raise
            return []

    def download_fit(self, activity_id: str) -> bytes | None:
        try:
            content = self._get(
                f"{self._base}/download-service/files/activity/{activity_id}"
            ).content
        except GarminAPIError as exc:
            if exc.status_code == 429:
                raise
            return None

        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                for name in zf.namelist():
                    if name.lower().endswith(".fit"):
                        return zf.read(name)
        except zipfile.BadZipFile:
            pass
        return None

    def get_user_settings(self) -> dict[str, Any]:
        return self._get(f"{self._base}/userprofile-service/userprofile/user-settings").json()

    def get_calendar_month(self, year: int, month: int) -> dict[str, Any]:
        url = f"{self._base}/calendar-service/year/{year}/month/{month - 1}"
        return self._get(url).json()

    def get_workout_detail(self, workout_id: str) -> dict[str, Any]:
        url = f"{self._base}/workout-service/workout/{workout_id}"
        return self._get(url).json()

    def get_adaptive_workout_detail(self, workout_uuid: str) -> dict[str, Any]:
        url = f"{self._base}/workout-service/fbt-adaptive/{workout_uuid}"
        return self._get(url).json()

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "GarminClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()
