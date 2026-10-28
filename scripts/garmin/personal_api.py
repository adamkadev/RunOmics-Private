"""Garmin's Personal API: the athlete's own data, read with a key they create
in Garmin Connect.

  POST personalapitoken-service/.../personal-api-key/token   the key for a 24 h token
  GET  activitylist-service/activities/search/activities     the activity list
  GET  activity-service/activity/{id}                        one activity
  GET  download-service/files/activity/{id}                  its original file, zipped
  GET  biometric-service/heartRateZones/v2                   zone floors, LTHR, max HR
  GET  usersummary-service/v2/dailysummaries                 resting HR, day by day
  GET  fitnessage-service/fitnessage/v2/{date}               fitness age
  GET  weight-service/weight/range/{start}/{end}             weigh-ins

Read-only, and only what Garmin documents for it: the sync's other reads -
gear, training status, race predictions, the calendar - answer 404 on this
host and stay on Connect's private API (client.py). Where both serve the same
data the method names match GarminClient's, so sync.py reads activities from
either.

Unlike Connect's token, which only a scripted sign-in that Garmin keeps
changing can mint, the key is official: when it expires - a year at most -
the athlete creates another in Garmin Connect.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import httpx

from .errors import GarminAPIError, GarminAuthError
from .retry import retry_transient
from .shared import collect_activity_rows, fit_from_archive, zone_floors

DEFAULT_BASE_URL = "https://personal.connectapi.garmin.com"
TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token"
KEY_PAGE = "https://connect.garmin.com/app/settings/personalApiToken"
# The download is served as application/x-zip-compressed: an Accept list
# without it is answered 406.
ZIP_ACCEPT = "application/zip, application/x-zip-compressed, application/octet-stream"
_LIST_PATH = "/activitylist-service/activities/search/activities"
_TIMEOUT = httpx.Timeout(120.0, connect=30.0)

# What each refusal of the key most likely means. A 403 is also how Garmin
# answers an address it blocks, and a valid key shown once is not one to throw away over it.
_KEY_REFUSED = {
    400: "the key is malformed - check the secret holds the whole of it",
    401: f"it has expired or was revoked - create a new one at {KEY_PAGE}",
    403: f"either it was revoked (create a new one at {KEY_PAGE}) or Garmin blocks the address the "
    "request came from",
}


class PersonalApiClient:
    def __init__(self, api_key: str, *, base_url: str = DEFAULT_BASE_URL, transport: httpx.BaseTransport | None = None) -> None:
        self._key = api_key
        self._http = httpx.Client(base_url=base_url, timeout=_TIMEOUT, transport=transport)
        try:
            self._token = retry_transient(self._exchange_key)
        except Exception:
            self._http.close()
            raise
        # The list rows seen so far, by id: they carry each activity's time in
        # HR zones, which the Personal API serves nowhere else.
        self._rows: dict[str, dict[str, Any]] = {}
        # Each detail's start, which finds a row not paged through (--id).
        self._starts: dict[str, str] = {}
        self._zones: list[dict[str, Any]] | None = None

    def _exchange_key(self) -> str:
        resp = self._http.post(TOKEN_PATH, headers={"Accept": "*/*", "Authorization": f"ApiKey {self._key}"})
        reason = _KEY_REFUSED.get(resp.status_code)
        if reason:
            raise GarminAuthError(f"Garmin refused GARMIN_PERSONAL_API_KEY (HTTP {resp.status_code}): {reason}.")
        if resp.status_code >= 400:
            raise GarminAPIError(resp.status_code, TOKEN_PATH)
        token = resp.text.strip()
        if not token:
            raise GarminAuthError(
                f"Garmin answered the key exchange with no token (HTTP {resp.status_code}): something "
                "between the sync and Garmin - a proxy, a captive page - answered instead."
            )
        return token

    def _get(self, path: str, *, params: dict[str, Any] | None = None, accept: str = "application/json") -> httpx.Response:
        def send() -> httpx.Response:
            return self._http.get(path, params=params, headers={"Authorization": f"Bearer {self._token}", "Accept": accept})

        resp = send()
        if resp.status_code == 401:
            # The token lasts 24 hours; a sync that outlives it gets another.
            self._token = self._exchange_key()
            resp = send()
        if resp.status_code >= 400:
            raise GarminAPIError(resp.status_code, path)
        return resp

    def _get_json(self, path: str, **params: Any) -> Any:
        resp = self._get(path, params=params or None)
        # A period without data answers 204 and no body.
        return resp.json() if resp.content.strip() else None

    # --- activities ------------------------------------------------------

    def get_activities(
        self, start: int = 0, limit: int = 100, *, running_only: bool = True, since: str | None = None
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"start": start, "limit": limit}
        if running_only:
            params["activityType"] = "running"
        if since:
            params["startDate"] = since
        rows = self._get_json(_LIST_PATH, **params) or []
        self._rows.update((str(row["activityId"]), row) for row in rows)
        return rows

    def get_activity_rows(self, *, running_only: bool = True) -> dict[str, dict[str, Any]]:
        return collect_activity_rows(self.get_activities, running_only=running_only)

    def get_activity_detail(self, activity_id: str) -> dict[str, Any]:
        # An empty answer raises rather than passing for an activity: mapped,
        # {} would be stored for good under the id "".
        detail = self._get(f"/activity-service/activity/{activity_id}").json()
        start = (detail.get("summaryDTO") or {}).get("startTimeLocal") if isinstance(detail, dict) else None
        if isinstance(start, str):
            self._starts[activity_id] = start
        return detail

    def download_fit(self, activity_id: str, *, strict_errors: bool = False) -> bytes | None:
        """The activity's original FIT file, or None for an activity without one.

        Same contract as GarminClient.download_fit: None is a 404 (unless
        strict_errors), an empty download or an archive without a .fit; a
        download that is not an archive raises zipfile.BadZipFile.
        """
        try:
            resp = self._get(f"/download-service/files/activity/{activity_id}", accept=ZIP_ACCEPT)
        except GarminAPIError as exc:
            if exc.status_code == 404 and not strict_errors:
                return None
            raise
        return fit_from_archive(resp.content) if resp.content else None

    def get_hr_zones(self, activity_id: str) -> list[dict[str, Any]]:
        """Time in each HR zone, in the shape Connect's hrTimeInZones answers.

        The Personal API has no such endpoint. The seconds are the activity's
        own, from its row in the list (hrTimeInZone_1..5); each zone's floor is
        the athlete's current running zones, which is what Connect reports for
        the activity unless the zones were changed since it was recorded.
        """
        row = self._rows.get(activity_id) or self._find_row(activity_id)
        floors = zone_floors(self.get_heart_rate_zones())
        zones: list[dict[str, Any]] = []
        for n in range(1, 6):
            seconds = row.get(f"hrTimeInZone_{n}")
            if seconds is None:
                continue
            zone: dict[str, Any] = {"zoneNumber": n, "secsInZone": seconds}
            if floors:
                zone["zoneLowBoundary"] = floors[n - 1]
            zones.append(zone)
        return zones

    def _find_row(self, activity_id: str) -> dict[str, Any]:
        """The list row of an activity not paged through yet (sync.py --id):
        the list filtered to the days around its start. Not finding it raises:
        "no zones" would be stored over the zones on file."""
        if activity_id not in self._starts:
            self.get_activity_detail(activity_id)
        try:
            started = date.fromisoformat(self._starts.get(activity_id, "")[:10])
        except ValueError:
            raise LookupError(f"activity {activity_id} has no start date to find its list row by") from None
        # A day either side: the filter's day may be GMT's where the run's is local.
        around = {"startDate": (started - timedelta(days=1)).isoformat(), "endDate": (started + timedelta(days=1)).isoformat()}
        rows = self._get_json(_LIST_PATH, start=0, limit=100, **around) or []
        self._rows.update((str(row["activityId"]), row) for row in rows)
        if activity_id not in self._rows:
            raise LookupError(f"activity {activity_id} is not in the activity list around {started}")
        return self._rows[activity_id]

    # --- the athlete -----------------------------------------------------

    def get_heart_rate_zones(self) -> list[dict[str, Any]]:
        """Zone floors, LTHR, max and resting HR, per sport: DEFAULT, and
        RUNNING where the athlete set running zones of their own."""
        if self._zones is None:
            self._zones = self._get_json("/biometric-service/heartRateZones/v2") or []
        return self._zones

    def get_daily_summaries(self, start: str, end: str) -> list[dict[str, Any]]:
        payload = self._get_json("/usersummary-service/v2/dailysummaries", startDate=start, endDate=end)
        return (payload or {}).get("data") or []

    def get_current_fitness_age(self, day: str) -> dict[str, Any]:
        return self._get_json(f"/fitnessage-service/fitnessage/v2/{day}") or {}

    def get_weight_range(self, start: str, end: str) -> dict[str, Any]:
        return self._get_json(f"/weight-service/weight/range/{start}/{end}", includeAll="true") or {}

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> PersonalApiClient:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

