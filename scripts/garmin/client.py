from __future__ import annotations

import io
import os
import zipfile
from typing import Any

import garth
import httpx

os.environ.setdefault("GARTH_TELEMETRY_ENABLED", "false")

_CONNECT_API = "https://connectapi.garmin.com"
_CONNECT_WEB = "https://connect.garmin.com"
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
        self._profile_uuid: str | None = None

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

    def get_gear_list(self, status: str, start: int = 0, limit: int = 100) -> list[dict[str, Any]]:
        return self._get(
            f"{self._base}/gear-service/gear/v2/list",
            params={"start": start, "limit": limit, "gearStatuses": status, "sortOrder": "firstUseDate_desc"},
        ).json()

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

    # Garmin Connect's web front-end calls both of these under a /gc-api/ prefix
    # on connect.garmin.com; on connectapi.garmin.com the prefix does not exist.
    # `weekly` names the view, not the granularity: it is the four-week view and
    # its records are daily. (`monthly` is the same series sampled once a week.)
    def get_training_status_daily(self, start: str, end: str) -> dict[str, Any]:
        return self._get(
            f"{self._base}/metrics-service/metrics/trainingstatus/weekly/{self.get_profile_uuid()}",
            params={"fromCalendarDate": start, "toCalendarDate": end},
        ).json()

    def get_training_status_weekly(self, start: str, end: str) -> dict[str, Any]:
        """Garmin's own weekly rollup: the status at each week's close, same record shape."""
        return self._get(
            f"{self._base}/metrics-service/metrics/trainingstatus/monthly/{self.get_profile_uuid()}",
            params={"fromCalendarDate": start, "toCalendarDate": end},
        ).json()

    def get_training_load_balance(self, day: str) -> dict[str, Any]:
        return self._get(
            f"{self._base}/metrics-service/metrics/trainingloadbalance/latest/{day}"
        ).json()

    def get_social_profile(self) -> dict[str, Any]:
        return self._get(f"{self._base}/userprofile-service/socialProfile").json()

    def get_profile_uuid(self) -> str:
        """The account's profile UUID, which keys the race-prediction endpoint.

        Not the numeric user id and not the email: Garmin calls it `displayName`
        on the social profile, and it is the only accepted path segment there.
        """
        if self._profile_uuid is None:
            self._profile_uuid = str(self.get_social_profile()["displayName"])
        return self._profile_uuid

    # Dates go in the query string here, unlike the other metrics-service
    # endpoints which take them as path segments.
    def get_race_predictions(self, start: str, end: str) -> list[dict[str, Any]]:
        return self._get(
            f"{self._base}/metrics-service/metrics/racepredictions/daily/{self.get_profile_uuid()}",
            params={"fromCalendarDate": start, "toCalendarDate": end},
        ).json()

    def get_max_met_monthly(self, start: str, end: str) -> list[dict[str, Any]]:
        return self._get(
            f"{self._base}/metrics-service/metrics/maxmet/monthly/{start}/{end}"
        ).json()

    def get_max_met_daily(self, start: str, end: str) -> list[dict[str, Any]]:
        return self._get(
            f"{self._base}/metrics-service/metrics/maxmet/daily/{start}/{end}"
        ).json()

    def get_fitness_age(self, start: str, end: str) -> list[dict[str, Any]]:
        return self._get(f"{self._base}/fitnessage-service/stats/daily/{start}/{end}").json()

    def get_primary_training_device(self) -> dict[str, Any]:
        return self._get(f"{self._base}/web-gateway/device-info/primary-training-device").json()

    def get_heart_rate_zones(self) -> list[dict[str, Any]]:
        return self._get(f"{self._base}/biometric-service/heartRateZones/").json()

    def get_biometric_stat(self, metric: str, start: str, end: str) -> list[dict[str, Any]]:
        return self._get(
            f"{self._base}/biometric-service/stats/{metric}/range/{start}/{end}",
            params={
                "aggregation": "daily",
                "aggregationStrategy": "LATEST",
                "sport": "RUNNING",
            },
        ).json()

    def get_vo2max_norms(self) -> dict[str, Any]:
        return self._get(f"{_CONNECT_WEB}/web-data/vo2Max/VO2Max.json").json()

    def get_calendar_month(self, year: int, month: int) -> dict[str, Any]:
        url = f"{self._base}/calendar-service/year/{year}/month/{month - 1}"
        return self._get(url).json()

    def get_workout_detail(self, workout_id: str) -> dict[str, Any]:
        url = f"{self._base}/workout-service/workout/{workout_id}"
        return self._get(url).json()

    def get_adaptive_workout_detail(self, workout_uuid: str) -> dict[str, Any]:
        url = f"{self._base}/workout-service/fbt-adaptive/{workout_uuid}"
        return self._get(url).json()

    def get_training_plans(self) -> dict[str, Any]:
        return self._get(
            f"{self._base}/trainingplan-service/trainingplan/plans",
            params={"limit": 50},
        ).json()

    def get_training_plan_detail(self, plan_id: int | str) -> dict[str, Any]:
        url = f"{self._base}/trainingplan-service/trainingplan/fbt-adaptive/{plan_id}"
        return self._get(url).json()

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "GarminClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()
