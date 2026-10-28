#!/usr/bin/env python3
"""What Garmin's Personal API answers for this account, next to what the sync
reads from Connect's private API today.

    GARMIN_PERSONAL_API_KEY=... python scripts/diagnostics/probe_personal_api.py

With --compare, and GARMIN_SECRET set as well, one activity's detail and FIT
file are fetched from both sources and compared: the check that says whether
the mapper and the FIT parser can take the new source unchanged.

Read-only. The one POST is the key-for-token exchange; every call after it is
a GET. The sync's own paths (gear, metrics, calendar) are tried on the Personal
API host only to learn whether its gateway answers them. Nothing is written to
Garmin or to the data workspace.

The output is meant to be pasted into an issue: status codes, sizes, key names
and row counts, never a value. A key that is itself data - a date, a device id -
is masked. Neither the API key nor the token is ever printed.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sys
import time
import zipfile
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any

# Match sync.py's import behavior when this file is invoked directly.
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

from diagnostics.fit_inspector import inspect_fit_capabilities
from diagnostics.model import InvalidProbePayload
from garmin.personal_api import DEFAULT_BASE_URL, TOKEN_PATH, ZIP_ACCEPT
from garmin.shared import fit_from_archive as extract_fit
from processing.fit_parser import parse_fit

# The official client's defaults (garmin/connect-personal-api-python), so the
# same environment serves both.
BASE_URL_ENV = "GARMIN_PERSONAL_API_BASE_URL"
KEY_ENV = "GARMIN_PERSONAL_API_KEY"

_TIMEOUT = httpx.Timeout(60.0, connect=30.0)
_PAUSE_SECONDS = 1.0
_MAX_KEYS_SHOWN = 15

# Keys that are values in disguise: a calendar date, a numeric device or
# activity id, a UUID.
_DATA_LIKE_KEY = re.compile(r"^\d+$|^\d{4}-\d{2}-\d{2}|^[0-9a-f]{8}-[0-9a-f]{4}-", re.IGNORECASE)
_RATE_LIMIT_HEADER = re.compile(r"ratelimit|retry-after", re.IGNORECASE)


class ProbeAborted(Exception):
    """A response that makes every later call pointless: a rejected token, a 429."""


@dataclass(frozen=True)
class Probe:
    name: str
    path: str
    params: dict[str, Any] | None = None
    # The data file the sync fills from this, or "" for data it has no use
    # for yet.
    feeds: str = ""
    binary: bool = False


@dataclass
class Result:
    probe: Probe
    status: int | None
    size: int = 0
    shape: str = ""
    # The exception's class name for a transport failure. Never its message,
    # which can carry the URL.
    error: str = ""
    payload: Any = field(default=None, repr=False)
    content: bytes = field(default=b"", repr=False)

    @property
    def ok(self) -> bool:
        return self.status is not None and 200 <= self.status < 300


@dataclass(frozen=True)
class TokenInfo:
    token: str = field(repr=False)
    lifetime_hours: float | None
    claim_names: tuple[str, ...]
    scopes: tuple[str, ...]


def exchange_key(http: httpx.Client, key: str) -> TokenInfo:
    resp = http.post(TOKEN_PATH, headers={"Accept": "*/*", "Authorization": f"ApiKey {key}"})
    if resp.status_code >= 400:
        raise ProbeAborted(f"key exchange answered HTTP {resp.status_code}")
    token = resp.text.strip()
    if not token:
        raise ProbeAborted("key exchange answered an empty token")

    claims = _jwt_claims(token)
    issued, expires = claims.get("iat"), claims.get("exp")
    lifetime = (
        round((expires - issued) / 3600, 1)
        if isinstance(issued, (int, float)) and isinstance(expires, (int, float))
        else None
    )
    # Scope names are permissions, not personal data, and they are the most
    # direct answer to "what may this token read".
    raw_scopes = claims.get("scope", claims.get("scp", ()))
    scopes = tuple(raw_scopes.split()) if isinstance(raw_scopes, str) else tuple(map(str, raw_scopes or ()))
    return TokenInfo(token=token, lifetime_hours=lifetime, claim_names=tuple(sorted(claims)), scopes=scopes)


class PersonalApiProbe:
    def __init__(
        self,
        http: httpx.Client,
        token: str,
        *,
        as_of: date,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.http = http
        self.headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        self.as_of = as_of
        self.sleep = sleep
        self.rate_headers: dict[str, str] = {}
        self.results: list[Result] = []

    def run(self) -> dict[str, list[Result]]:
        day = self.as_of - timedelta(days=1)
        activities = self.fetch(
            Probe(
                "activities",
                "/activitylist-service/activities/search/activities",
                {"start": 0, "limit": 20, "activityType": "running"},
                feeds="activities/",
            )
        )
        if activities.status == 401:
            raise ProbeAborted("the token was refused on the first data call (401)")
        activity_id = _first_activity_id(activities.payload)

        documented = [activities] + [self.fetch(p) for p in documented_probes(day, self.as_of, activity_id)]

        social = self.fetch(Probe("socialProfile", "/userprofile-service/socialProfile", feeds="(profile id)"))
        settings = next((r for r in documented if r.probe.name == "profileSettings"), None)
        profile_id = _profile_id(social.payload) or _profile_id(settings.payload if settings else None)

        sync = [social] + [self.fetch(p) for p in sync_probes(day, activity_id, profile_id)]
        return {"documented": documented, "sync": sync}

    def fetch(self, probe: Probe) -> Result:
        missing = _missing_id(probe)
        if missing:
            return Result(probe, status=None, error=f"skipped: no {missing}")
        self.sleep(_PAUSE_SECONDS)
        accept = ZIP_ACCEPT if probe.binary else "application/json"
        try:
            resp = self.http.get(probe.path, params=probe.params, headers={**self.headers, "Accept": accept})
        except httpx.HTTPError as exc:
            result = Result(probe, status=None, error=type(exc).__name__)
            self.results.append(result)
            return result

        for name, value in resp.headers.items():
            if _RATE_LIMIT_HEADER.search(name):
                self.rate_headers[name.lower()] = value

        result = Result(probe, status=resp.status_code, size=len(resp.content), content=resp.content)
        if result.ok:
            if probe.binary:
                result.shape = _describe_archive(resp.content)
            elif not resp.content.strip():
                result.shape = "empty"
            else:
                try:
                    result.payload = resp.json()
                    result.shape = describe(result.payload)
                except ValueError:
                    result.shape = "not JSON"
        self.results.append(result)
        if resp.status_code == 429:
            raise ProbeAborted(f"rate limited (429) at {probe.name}")
        return result


def documented_probes(day: date, as_of: date, activity_id: str | None) -> list[Probe]:
    """The endpoints Garmin documents for the Personal API, minus the activity list."""
    week = f"{day - timedelta(days=6)}/{day}"
    start, end = str(day - timedelta(days=6)), str(day)
    activity = activity_id or "{activity id}"
    return [
        Probe("activity", f"/activity-service/activity/{activity}", feeds="activities/"),
        Probe("activityWorkouts", f"/activity-service/activity/{activity}/workouts"),
        Probe("activityFile", f"/download-service/files/activity/{activity}", feeds="activities/ (FIT)", binary=True),
        Probe("profileSettings", "/userprofile-service/userprofile/settings", feeds="athlete.json"),
        Probe("heartRateZones", "/biometric-service/heartRateZones/v2", feeds="athlete.json"),
        Probe("fitnessAge", f"/fitnessage-service/fitnessage/v2/{day}", feeds="athlete.json"),
        Probe("hrvNight", f"/hrv-service/hrv/{day}"),
        Probe("hrvRange", f"/hrv-service/hrv/daily/{week}"),
        Probe(
            "dailySummaries",
            "/usersummary-service/v2/dailysummaries",
            {"startDate": start, "endDate": end},
            feeds="recovery_history.json",
        ),
        Probe("dailyHeartRate", "/wellness-service/wellness/dailyHeartRate", {"date": str(day)}),
        Probe("sleep", "/sleep-service/sleep/dailySleep", {"date": str(day)}),
        Probe("sleepSummaries", "/sleep-service/sleep/dailySleepSummariesByDate", {"startDate": start, "endDate": end}),
        Probe("bodyBattery", "/wellness-service/wellness/bodyBattery/reports/daily", {"startDate": start, "endDate": end}),
        Probe("stress", f"/usersummary-service/stats/stress/daily/{week}"),
        Probe("steps", f"/usersummary-service/stats/steps/daily/{week}"),
        Probe("hydration", f"/usersummary-service/stats/hydration/daily/{week}"),
        Probe("spo2", f"/wellness-service/wellness/daily/spo2acclimation/{day}"),
        Probe("weight", f"/weight-service/weight/range/{week}", {"includeAll": "true"}, feeds="athlete.json"),
        Probe("weightGoals", f"/goal-service/goal/user/effective/weightgoal/{week}"),
        Probe("foodLogs", f"/nutrition-service/food/logs/{day}"),
        Probe("wellnessActivities", f"/wellnessactivity-service/activity/summary/range/{week}"),
        Probe("menstrualSummary", f"/periodichealth-service/menstrualcycle/summary/{day}"),
        Probe("menstrualDayView", f"/periodichealth-service/menstrualcycle/dayview/{day}", {"todayDate": str(as_of)}),
    ]


def sync_probes(day: date, activity_id: str | None, profile_id: str | None) -> list[Probe]:
    """The paths scripts/garmin/client.py reads that Garmin does not document
    for the Personal API. Same windows as the sync uses, near enough."""
    month = f"{day - timedelta(days=27)}/{day}"
    year = f"{day - timedelta(days=364)}/{day}"
    activity = activity_id or "{activity id}"
    profile = profile_id or "{profile id}"

    def window(days: int) -> dict[str, str]:
        return {"fromCalendarDate": str(day - timedelta(days=days - 1)), "toCalendarDate": str(day)}

    threshold = {"aggregation": "daily", "aggregationStrategy": "LATEST", "sport": "RUNNING"}
    return [
        Probe("activityHrZones", f"/activity-service/activity/{activity}/hrTimeInZones", feeds="activities/"),
        Probe("activityGear", "/gear-service/gear/filterGear", {"activityId": activity}, feeds="activities/"),
        Probe(
            "gearList",
            "/gear-service/gear/v2/list",
            {"start": 0, "limit": 100, "gearStatuses": "ACTIVE", "sortOrder": "firstUseDate_desc"},
            feeds="shoes.json",
        ),
        Probe("userSettings", "/userprofile-service/userprofile/user-settings", feeds="athlete.json"),
        Probe("primaryDevice", "/web-gateway/device-info/primary-training-device", feeds="athlete.json"),
        Probe("heartRateZonesV1", "/biometric-service/heartRateZones/", feeds="athlete.json"),
        Probe("currentFitnessAge", f"/fitnessage-service/fitnessage/{day}", feeds="athlete.json"),
        Probe("fitnessAgeDaily", f"/fitnessage-service/stats/daily/{month}", feeds="fitness_age_history.json"),
        Probe("fitnessAgeWeekly", f"/fitnessage-service/stats/weekly/{day}/52", feeds="fitness_age_history.json"),
        Probe(
            "thresholdHeartRate",
            f"/biometric-service/stats/lactateThresholdHeartRate/range/{year}",
            threshold,
            feeds="athlete_history.json",
        ),
        Probe(
            "thresholdSpeed",
            f"/biometric-service/stats/lactateThresholdSpeed/range/{year}",
            threshold,
            feeds="athlete_history.json",
        ),
        Probe("vo2maxDaily", f"/metrics-service/metrics/maxmet/daily/{month}", feeds="vo2max_history.json"),
        Probe("vo2maxMonthly", f"/metrics-service/metrics/maxmet/monthly/{year}", feeds="vo2max_history.json"),
        Probe(
            "trainingStatusDaily",
            f"/metrics-service/metrics/trainingstatus/weekly/{profile}",
            window(28),
            feeds="training_status.json",
        ),
        Probe(
            "trainingStatusWeekly",
            f"/metrics-service/metrics/trainingstatus/monthly/{profile}",
            window(182),
            feeds="training_status.json",
        ),
        Probe("loadBalance", f"/metrics-service/metrics/trainingloadbalance/latest/{day}", feeds="training_status.json"),
        Probe(
            "racePredictions",
            f"/metrics-service/metrics/racepredictions/daily/{profile}",
            window(120),
            feeds="race_predictions.json",
        ),
        Probe(
            "restingHeartRate",
            f"/userstats-service/wellness/daily/{profile}",
            {"fromDate": str(day - timedelta(days=27)), "untilDate": str(day), "metricId": 60},
            feeds="recovery_history.json",
        ),
        Probe("calendarMonth", f"/calendar-service/year/{day.year}/month/{day.month - 1}", feeds="planned_workouts/"),
        Probe(
            "upcomingEvents",
            "/calendar-service/events/upcoming",
            {"numDaysForward": 365, "limit": 100},
            feeds="upcoming_races.json",
        ),
        Probe("trainingPlans", "/trainingplan-service/trainingplan/plans", {"limit": 50}, feeds="planned_workouts/"),
    ]


def describe(payload: Any) -> str:
    """The shape of a JSON payload, with no value in it."""
    if payload is None:
        return "empty"
    if isinstance(payload, dict):
        return f"object {{{_key_list(payload)}}}"
    if isinstance(payload, list):
        if not payload:
            return "list of 0"
        first = payload[0]
        if isinstance(first, dict):
            return f"list of {len(payload)}, rows {{{_key_list(first)}}}"
        return f"list of {len(payload)} {type(first).__name__}"
    return type(payload).__name__


def key_names(mapping: dict[str, Any]) -> list[str]:
    return sorted({"<id>" if _DATA_LIKE_KEY.match(str(key)) else str(key) for key in mapping})


def _key_list(mapping: dict[str, Any]) -> str:
    names = key_names(mapping)
    shown = ", ".join(names[:_MAX_KEYS_SHOWN])
    return shown + (f", +{len(names) - _MAX_KEYS_SHOWN} more" if len(names) > _MAX_KEYS_SHOWN else "")


def fit_features(fit: bytes) -> set[str]:
    """inspect_fit_capabilities' allowlist, plus the Firstbeat VO2max message
    (140) the sync reads per run - the field reported stripped from FIT files
    Garmin serves to partner APIs."""
    features = inspect_fit_capabilities(fit)
    if parse_fit(fit).vo2max_garmin is not None:
        features.add("vo2maxGarmin")
    return features


def _describe_archive(content: bytes) -> str:
    try:
        fit = extract_fit(content)
    except zipfile.BadZipFile:
        return "not a ZIP"
    return "ZIP with a .fit" if fit else "ZIP without a .fit"


def _jwt_claims(token: str) -> dict[str, Any]:
    try:
        segment = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))
    except (IndexError, ValueError):
        return {}
    return claims if isinstance(claims, dict) else {}


def _missing_id(probe: Probe) -> str | None:
    """The id a probe still waits on - an earlier call did not return it - in
    its path or its query."""
    for text in (probe.path, *map(str, (probe.params or {}).values())):
        if "{" in text:
            return text.split("{", 1)[1].split("}", 1)[0]
    return None


def _first_activity_id(payload: Any) -> str | None:
    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        value = payload[0].get("activityId")
        return str(value) if value is not None else None
    return None


def _profile_id(payload: Any) -> str | None:
    value = payload.get("displayName") if isinstance(payload, dict) else None
    return str(value) if value else None


def format_report(token: TokenInfo, groups: dict[str, list[Result]], rate_headers: dict[str, str]) -> list[str]:
    lifetime = f"valid {token.lifetime_hours} h" if token.lifetime_hours is not None else "lifetime unknown"
    lines = [f"Token: issued, {lifetime}; claims: {', '.join(token.claim_names) or 'none readable'}"]
    if token.scopes:
        lines.append(f"Scopes: {', '.join(token.scopes)}")

    titles = {
        "documented": "Documented Personal API endpoints",
        "sync": "Paths the sync reads today (Connect's private API), tried on the Personal API host",
        "partial": "Calls made before stopping",
    }
    for group, results in groups.items():
        answered = sum(r.ok for r in results)
        lines += ["", f"{titles[group]}: {answered}/{len(results)} answered"]
        for r in results:
            status = str(r.status) if r.status is not None else "-"
            detail = r.shape if r.ok else r.error
            feeds = f"  -> {r.probe.feeds}" if r.probe.feeds else "  (new data)" if group == "documented" else ""
            lines.append(f"  {status:>4}  {r.probe.name:<22}{feeds}")
            if detail:
                lines.append(f"        {detail}")

    if rate_headers:
        lines += ["", "Rate-limit headers: " + ", ".join(f"{k}={v}" for k, v in sorted(rate_headers.items()))]
    else:
        lines += ["", "Rate-limit headers: none sent"]
    return lines


def fit_report(results: list[Result]) -> list[str]:
    download = next((r for r in results if r.probe.name == "activityFile" and r.ok), None)
    if download is None:
        return ["", "FIT file: not downloaded"]
    try:
        fit = extract_fit(download.content)
        if fit is None:
            return ["", "FIT file: the download holds no .fit"]
        features = fit_features(fit)
    except (zipfile.BadZipFile, InvalidProbePayload):
        return ["", "FIT file: could not be decoded"]
    return ["", f"FIT file features: {', '.join(sorted(features)) or 'none'}"]


def compare_report(results: list[Result], secret: str) -> list[str]:
    """One activity through both sources: what the switch would lose."""
    from garmin.client import GarminClient
    from processing.mapper import map_activity

    detail = next((r for r in results if r.probe.name == "activity" and r.ok), None)
    download = next((r for r in results if r.probe.name == "activityFile" and r.ok), None)
    if detail is None or not isinstance(detail.payload, dict):
        return ["", "Compare: skipped, the Personal API returned no activity detail"]
    activity_id = detail.probe.path.rsplit("/", 1)[1]

    with GarminClient(secret) as client:
        connect_detail = client.get_activity_detail(activity_id)
        connect_fit = client.download_fit(activity_id, strict_errors=True)

    personal_fit = extract_fit(download.content) if download else None
    lines = ["", "Compare with Connect's private API (GARMIN_SECRET), first activity of the list"]
    lines += _key_diff("activity detail keys", detail.payload, connect_detail)
    lines += _key_diff("summaryDTO keys", detail.payload.get("summaryDTO") or {}, connect_detail.get("summaryDTO") or {})

    if personal_fit is None or connect_fit is None:
        lines.append("  FIT: missing from " + ("the Personal API" if personal_fit is None else "Connect"))
    else:
        same = hashlib.sha256(personal_fit).digest() == hashlib.sha256(connect_fit).digest()
        lines.append(f"  FIT files identical: {'yes' if same else 'no'}")
        if not same:
            lines += _set_diff("FIT features", fit_features(personal_fit), fit_features(connect_fit))

    # The mapper is what turns either source into a stored run: a field it
    # fills from Connect and not from the Personal API is a field the switch
    # would drop from every new activity.
    mapped: dict[str, dict[str, Any]] = {}
    for source, payload, fit in (("Personal API", detail.payload, personal_fit), ("Connect", connect_detail, connect_fit)):
        try:
            mapped[source] = map_activity(payload, parse_fit(fit) if fit else None).to_dict()
        except Exception as exc:
            # A refusal is the finding, not a reason to drop the rest.
            lines.append(f"  the mapper refused the {source} detail ({type(exc).__name__})")
    if len(mapped) == 2:
        connect, personal = mapped["Connect"], mapped["Personal API"]
        lost = sorted(k for k, v in connect.items() if v is not None and personal.get(k) is None)
        lines.append(f"  mapped fields lost on the Personal API: {', '.join(lost) or 'none'}")
    return lines


def _key_diff(label: str, personal: dict[str, Any], connect: dict[str, Any]) -> list[str]:
    return _set_diff(label, set(key_names(personal)), set(key_names(connect)))


def _set_diff(label: str, personal: set[str], connect: set[str]) -> list[str]:
    only_connect, only_personal = sorted(connect - personal), sorted(personal - connect)
    if not only_connect and not only_personal:
        return [f"  {label}: the same"]
    return [
        f"  {label} only on Connect: {', '.join(only_connect) or 'none'}",
        f"  {label} only on the Personal API: {', '.join(only_personal) or 'none'}",
    ]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe Garmin's Personal API, read-only, printing shapes only")
    parser.add_argument(
        "--as-of",
        type=date.fromisoformat,
        default=date.today(),
        metavar="YYYY-MM-DD",
        help="Probe windows end the day before this date (default: today)",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Also fetch the first activity through GARMIN_SECRET and compare the two sources",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    key = os.environ.get(KEY_ENV, "").strip()
    if not key:
        print(f"Error: {KEY_ENV} is not set; nothing was sent to Garmin.", file=sys.stderr)
        return 2
    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if args.compare and not secret:
        print("Error: --compare needs GARMIN_SECRET as well; nothing was sent to Garmin.", file=sys.stderr)
        return 2

    base_url = os.environ.get(BASE_URL_ENV, DEFAULT_BASE_URL).rstrip("/")
    with httpx.Client(base_url=base_url, timeout=_TIMEOUT) as http:
        try:
            token = exchange_key(http, key)
        except ProbeAborted as exc:
            print(f"Error: {exc}.", file=sys.stderr)
            return 3
        except httpx.HTTPError as exc:
            print(f"Error: key exchange failed ({type(exc).__name__}).", file=sys.stderr)
            return 3

        probe = PersonalApiProbe(http, token.token, as_of=args.as_of)
        aborted = None
        try:
            groups = probe.run()
        except ProbeAborted as exc:
            aborted = str(exc)
            groups = {"partial": probe.results}

    for line in format_report(token, groups, probe.rate_headers):
        print(line)
    if aborted:
        print(f"\nStopped early: {aborted}.")
        return 4

    for line in fit_report(groups["documented"]):
        print(line)
    if args.compare:
        try:
            lines = compare_report(groups["documented"], secret)
        except Exception as exc:
            # The class name only: an auth or HTTP error message can carry a
            # URL or a token fragment.
            lines = ["", f"Compare: failed ({type(exc).__name__})"]
        for line in lines:
            print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
