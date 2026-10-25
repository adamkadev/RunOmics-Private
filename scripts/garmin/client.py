from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import garth
import httpx

from .errors import GarminAPIError, GarminAuthError
from .shared import collect_activity_starts, fit_from_archive

os.environ.setdefault("GARTH_TELEMETRY_ENABLED", "false")

_CONNECT_API = "https://connectapi.garmin.com"
_CONNECT_WEB = "https://connect.garmin.com"
_TIMEOUT = httpx.Timeout(120.0, connect=30.0)
_USER_AGENT = "Mozilla/5.0 (RunOmics/1.0)"


__all__ = ["GarminAPIError", "GarminAuthError", "GarminClient"]


def _json_or_empty(resp: httpx.Response) -> dict[str, Any]:
    """The response's JSON, or {} for a body-less "no data" answer (a 204)."""
    return resp.json() if resp.content.strip() else {}


_CONSUMER_KEY_ENV = "GARMIN_OAUTH_CONSUMER_KEY"
_CONSUMER_SECRET_ENV = "GARMIN_OAUTH_CONSUMER_SECRET"

# Garmin's own Android client credentials. Not this athlete's, and not secret:
# they are the same for every Garmin user, they ship inside Garmin's Android
# app, and garth's bucket serves them to anyone who asks. Configuration, so
# they live in the repository where they are visible and need no setup.
#
# They are here at all because garth fetches them at runtime from
# thegarth.s3.amazonaws.com - a bucket belonging to a project its author has
# abandoned - once per process, which means every nightly run. The day that
# bucket goes, a sync that would otherwise have worked for another year stops.
_OAUTH_CONSUMER = {
    "consumer_key": "fc3e99d2-118c-44b8-8ae3-03370dde24c0",
    "consumer_secret": "E08WAR897WEy2knn7aFBrvegVAf0AFdWBBF",
}


def _seed_oauth_consumer() -> None:
    """Fill in the OAuth1 consumer before garth can go looking for it.

    garth fetches only while its module global is still empty, so filling it
    first settles the question. The environment variables are the escape hatch
    for the day Garmin rotates the pair and a released constant is stale.
    """
    key = os.environ.get(_CONSUMER_KEY_ENV, "").strip()
    secret = os.environ.get(_CONSUMER_SECRET_ENV, "").strip()

    garth.sso.OAUTH_CONSUMER = (
        {"consumer_key": key, "consumer_secret": secret}
        if key and secret
        else dict(_OAUTH_CONSUMER)
    )


# The day this fires is the day the pipeline stops, and a bare exception would
# send the reader looking for a network fault. garth's login flow - the only
# supported way to mint a replacement - was broken by a Garmin auth change in
# March 2026 and the package is unmaintained, so the recovery is not obvious
# and the message has to carry it.
_REFRESH_FAILED = (
    "Token refresh failed: {exc}\n"
    "\n"
    "The OAuth1 token in GARMIN_SECRET has most likely expired. It is the long-"
    "lived credential every sync depends on, and garth cannot mint a new one: "
    "Garmin changed the auth flow in March 2026, which is why garth was "
    "deprecated. scripts/get_secret.py will fail for the same reason.\n"
    "\n"
    "Run npm run coach:garmin-auth to confirm, then see 'Optional: the "
    "garth token' under Setup in README.md and the linked garth discussion "
    "for the current workaround."
)


def _auth_field(token: Any, name: str) -> Any:
    value = getattr(token, name, None)
    if value is None:
        return None
    # expires_at and friends are epoch seconds; a date is what a human needs.
    if name.endswith("_at"):
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat(timespec="seconds")
    return value


class GarminClient:
    def __init__(self, secret_string: str) -> None:
        # Before anything can trigger a refresh: every entry point in scripts/
        # reaches Garmin through this constructor.
        _seed_oauth_consumer()

        garth.client.loads(secret_string)

        if garth.client.oauth2_token.expired:
            try:
                garth.client.refresh_oauth2()
            except Exception as exc:
                raise GarminAuthError(_REFRESH_FAILED.format(exc=exc)) from exc

        self._base = _CONNECT_API
        self._http = httpx.Client(timeout=_TIMEOUT)
        self._profile_uuid: str | None = None

    def auth_state(self) -> dict[str, Any]:
        """What is knowable about the tokens, for `npm run coach:garmin-auth`.

        The OAuth1 token carries no expiry - garth does not record one and
        Garmin does not return one - so its remaining life cannot be reported,
        only whether it still works. That it does is proved by this call having
        got far enough to run at all.
        """
        oauth2 = garth.client.oauth2_token
        return {
            "oauth1": {
                "present": garth.client.oauth1_token is not None,
                "expiresAt": None,
                "note": "no expiry recorded; refreshes working means it is still valid",
            },
            "oauth2": {
                "expiresAt": _auth_field(oauth2, "expires_at"),
                "expired": bool(getattr(oauth2, "expired", False)),
                "refreshTokenExpiresAt": _auth_field(oauth2, "refresh_token_expires_at"),
                "refreshExpired": bool(getattr(oauth2, "refresh_expired", False)),
            },
        }

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": str(garth.client.oauth2_token),
            "NK": "NT",
            "User-Agent": _USER_AGENT,
        }

    def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        resp = self._http.request(method, url, headers=self._headers(), **kwargs)

        if resp.status_code == 401:
            garth.client.refresh_oauth2()
            resp = self._http.request(method, url, headers=self._headers(), **kwargs)

        if resp.status_code >= 400:
            raise GarminAPIError(resp.status_code, url)

        return resp

    def _get(self, url: str, **kwargs: Any) -> httpx.Response:
        return self._request("GET", url, **kwargs)

    # Write verbs. Every caller is an explicit, single-resource mutation - there
    # is deliberately no bulk/list-wide variant of either.
    def _post(self, url: str, **kwargs: Any) -> httpx.Response:
        return self._request("POST", url, **kwargs)

    def _delete(self, url: str, **kwargs: Any) -> httpx.Response:
        return self._request("DELETE", url, **kwargs)

    def get_activities(
        self,
        start: int = 0,
        limit: int = 100,
        *,
        running_only: bool = True,
        since: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"start": start, "limit": limit}
        if running_only:
            params["activityType"] = "running"
        if since:
            params["startDate"] = since
        return self._get(
            f"{self._base}/activitylist-service/activities/search/activities",
            params=params,
        ).json()

    def get_activity_starts(self, *, running_only: bool = True) -> dict[str, str | None]:
        return collect_activity_starts(self.get_activities, running_only=running_only)

    def get_activity_detail(self, activity_id: str) -> dict[str, Any]:
        return self._get(
            f"{self._base}/activity-service/activity/{activity_id}"
        ).json()

    def _get_optional(self, url: str, *, strict_errors: bool, **kwargs: Any) -> httpx.Response | None:
        """GET a per-activity resource the activity may simply not have.

        Only a 404 means "not there", and comes back as None. Every other
        error - a 5xx, a 429, a dropped connection - raises, so that
        retry_transient retries it and, failing that, the activity fails and
        is fetched again next run. Reading a 503 as "no data" stored the
        activity without its track, zones or gear for good.

        strict_errors raises the 404 too: for diagnostics, where a missing
        resource must not pass for an empty one, and for a caller whose
        "nothing" would overwrite a value already on file.
        """
        try:
            return self._get(url, **kwargs)
        except GarminAPIError as exc:
            if exc.status_code == 404 and not strict_errors:
                return None
            raise

    def get_hr_zones(
        self, activity_id: str, *, strict_errors: bool = False
    ) -> list[dict[str, Any]]:
        resp = self._get_optional(
            f"{self._base}/activity-service/activity/{activity_id}/hrTimeInZones",
            strict_errors=strict_errors,
        )
        return resp.json() if resp is not None else []

    def get_activity_gear(
        self, activity_id: str, *, strict_errors: bool = False
    ) -> list[dict[str, Any]]:
        resp = self._get_optional(
            f"{self._base}/gear-service/gear/filterGear",
            strict_errors=strict_errors,
            params={"activityId": activity_id},
        )
        return resp.json() if resp is not None else []

    def get_gear_list(self, status: str, start: int = 0, limit: int = 100) -> list[dict[str, Any]]:
        return self._get(
            f"{self._base}/gear-service/gear/v2/list",
            params={"start": start, "limit": limit, "gearStatuses": status, "sortOrder": "firstUseDate_desc"},
        ).json()

    def download_fit(self, activity_id: str, *, strict_errors: bool = False) -> bytes | None:
        """The activity's original FIT file, or None for an activity without one.

        None is a 404, an empty download, or an archive with no .fit inside
        (an activity imported from a GPX, say). A download that is not an
        archive at all raises zipfile.BadZipFile: that is a broken transfer,
        not a missing file, and it must fail the activity like any other error.
        """
        resp = self._get_optional(
            f"{self._base}/download-service/files/activity/{activity_id}",
            strict_errors=strict_errors,
        )
        if resp is None or not resp.content:
            return None
        return fit_from_archive(resp.content)

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

    def get_current_fitness_age(self, day: str) -> dict[str, Any]:
        return self._get(f"{self._base}/fitnessage-service/fitnessage/{day}").json()

    def get_fitness_age_weekly(
        self, day: str, weeks: int = 52
    ) -> list[dict[str, Any]]:
        return self._get(
            f"{self._base}/fitnessage-service/stats/weekly/{day}/{weeks}"
        ).json()

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

    # Metric 60 is the daily resting heart rate, over any date range. A period
    # without data answers 204 and no body, which .json() cannot read.
    def get_resting_hr_range(self, start: str, end: str) -> dict[str, Any]:
        return _json_or_empty(
            self._get(
                f"{self._base}/userstats-service/wellness/daily/{self.get_profile_uuid()}",
                params={"fromDate": start, "untilDate": end, "metricId": 60},
            )
        )

    def get_vo2max_norms(self) -> dict[str, Any]:
        return self._get(f"{_CONNECT_WEB}/web-data/vo2Max/VO2Max.json").json()

    def get_calendar_month(self, year: int, month: int) -> dict[str, Any]:
        url = f"{self._base}/calendar-service/year/{year}/month/{month - 1}"
        return self._get(url).json()

    def get_upcoming_events(
        self,
        *,
        num_days_forward: int = 365,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        return self._get(
            f"{self._base}/calendar-service/events/upcoming",
            params={
                "numDaysForward": num_days_forward,
                "limit": limit,
            },
        ).json()

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

    # --- workout writes -------------------------------------------------
    # Garmin's private workout-service. Creating and scheduling are two calls:
    # the first stores a workout template in the library, the second puts that
    # template on a calendar date. Deleting mirrors it in reverse.

    def create_workout(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create one workout template. Returns Garmin's saved workout, which
        carries the assigned `workoutId`."""
        return self._post(f"{self._base}/workout-service/workout", json=payload).json()

    def schedule_workout(self, workout_id: str, day: str) -> dict[str, Any]:
        """Put an existing workout template on `day` (YYYY-MM-DD). Returns the
        calendar entry, which carries `workoutScheduleId`."""
        return self._post(
            f"{self._base}/workout-service/schedule/{workout_id}",
            json={"date": day},
        ).json()

    def unschedule_workout(self, schedule_id: str) -> None:
        """Remove one calendar entry, leaving its workout template in place."""
        self._delete(f"{self._base}/workout-service/schedule/{schedule_id}")

    def delete_workout(self, workout_id: str) -> None:
        """Delete one workout template from the library."""
        self._delete(f"{self._base}/workout-service/workout/{workout_id}")

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> GarminClient:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()
