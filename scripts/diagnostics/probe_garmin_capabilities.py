#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
import time
from collections.abc import Callable
from datetime import date, timedelta
from pathlib import Path
from typing import Any, TypeVar

# Match sync.py's import behavior when this file is invoked directly.
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

from diagnostics.fit_inspector import FIT_FEATURE_IDS, inspect_fit_capabilities
from diagnostics.model import (
    DiagnosticAuthError,
    InvalidProbePayload,
    ProbeStatus,
    SampleSummary,
    build_report,
    empty_accumulators,
    load_report,
    write_report_atomic,
)
from garmin.athlete import extract_primary_device
from garmin.client import GarminAPIError, GarminAuthError, GarminClient
from garmin.race_predictions import normalize_prediction
from garmin.threshold_history import normalize_stat
from garmin.training_status import normalize_load_balance, normalize_status_report

T = TypeVar("T")

ACTIVITY_LIMIT = 20
FITNESS_AGE_DAYS = 365
VO2MAX_MONTHLY_DAYS = 365
VO2MAX_DAILY_DAYS = 35
THRESHOLD_DAYS = 365
TRAINING_STATUS_DAYS = 28
TRAINING_STATUS_WEEKLY_DAYS = 182
RACE_PREDICTION_DAYS = 120
CALENDAR_MONTHS = 4
MAX_ATTEMPTS = 4

_USER_FEATURES = (
    "vo2max",
    "lactateThresholdHeartRate",
    "thresholdPace",
    "weight",
    "height",
)
_ZONE_FEATURES = ("heartRateZones", "restingHeartRate", "maxHeartRate")
_FITNESS_FEATURES = ("fitnessAge", "achievableFitnessAge", "bmi")
_TRAINING_FEATURES = (
    "trainingStatus",
    "acuteTrainingLoad",
    "chronicTrainingLoad",
    "acwr",
)


class ProbeRunner:
    def __init__(
        self,
        client: GarminClient,
        *,
        as_of: date,
        previous_report: dict[str, Any] | None = None,
        sleep: Callable[[float], None] = time.sleep,
        log: Callable[[str], None] = print,
    ) -> None:
        self.client = client
        self.as_of = as_of
        self.previous_report = previous_report
        self.sleep = sleep
        self.log = log
        self.features = empty_accumulators()
        self.device: dict[str, str] = {}

    def run(self) -> dict[str, Any]:
        self._probe_device()
        self._probe_user_settings()
        self._probe_hr_zones()
        self._probe_fitness_age()
        self._probe_vo2max()
        self._probe_thresholds()
        self._probe_profile_dependent_features()
        self._probe_load_balance()
        self._probe_gear()
        self._probe_training_plan()
        self._probe_calendar()
        self._probe_recent_activities()
        return build_report(
            as_of=self.as_of,
            device=self.device,
            accumulators=self.features,
            previous_report=self.previous_report,
        )

    def _probe_device(self) -> None:
        ok, value = self._fetch("primary device", self.client.get_primary_training_device)
        if not ok:
            return
        if not isinstance(value, dict):
            return
        try:
            sanitized = extract_primary_device(value)
        except Exception:
            return
        name = sanitized.get("deviceName")
        firmware = sanitized.get("deviceFirmware")
        if isinstance(name, str) and name:
            self.device["name"] = name
        if isinstance(firmware, str) and firmware:
            self.device["firmware"] = firmware

    def _probe_user_settings(self) -> None:
        self._probe_group(
            "user settings",
            _USER_FEATURES,
            self.client.get_user_settings,
            _user_settings_summaries,
        )

    def _probe_hr_zones(self) -> None:
        self._probe_group(
            "heart-rate zones",
            _ZONE_FEATURES,
            self.client.get_heart_rate_zones,
            _zone_summaries,
        )

    def _probe_fitness_age(self) -> None:
        start = self.as_of - timedelta(days=FITNESS_AGE_DAYS - 1)
        self._probe_group(
            "fitness age",
            _FITNESS_FEATURES,
            lambda: self.client.get_fitness_age(start.isoformat(), self.as_of.isoformat()),
            _fitness_age_summaries,
        )

    def _probe_profile_dependent_features(self) -> None:
        dependent = (*_TRAINING_FEATURES, "trainingStatusWeekly", "racePredictions")
        ok, value = self._fetch(
            "profile prerequisite",
            self.client.get_profile_uuid,
            stable_endpoint=False,
        )
        if not ok:
            self._fail_many(dependent, value)
            return
        if not isinstance(value, str) or not value:
            self._fail_many(dependent, "invalid_response")
            return
        # GarminClient caches the UUID. Do not retain, print, or serialize it.
        self._probe_training_status()
        self._probe_race_predictions()

    def _probe_vo2max(self) -> None:
        monthly_start = self.as_of - timedelta(days=VO2MAX_MONTHLY_DAYS - 1)
        daily_start = self.as_of - timedelta(days=VO2MAX_DAILY_DAYS - 1)
        self._probe_group(
            "monthly VO2max",
            ("vo2max",),
            lambda: self.client.get_max_met_monthly(monthly_start.isoformat(), self.as_of.isoformat()),
            lambda payload: {"vo2max": _max_met_summary(payload)},
        )
        self._probe_group(
            "daily VO2max",
            ("vo2max",),
            lambda: self.client.get_max_met_daily(daily_start.isoformat(), self.as_of.isoformat()),
            lambda payload: {"vo2max": _max_met_summary(payload)},
        )

    def _probe_thresholds(self) -> None:
        start = self.as_of - timedelta(days=THRESHOLD_DAYS - 1)
        for metric, feature, label in (
            ("lactateThresholdHeartRate", "lactateThresholdHeartRate", "threshold heart rate"),
            ("lactateThresholdSpeed", "thresholdPace", "threshold pace"),
        ):
            self._probe_group(
                label,
                (feature,),
                lambda m=metric: self.client.get_biometric_stat(
                    m, start.isoformat(), self.as_of.isoformat()
                ),
                lambda payload, f=feature: {f: _threshold_summary(payload)},
            )

    def _probe_training_status(self) -> None:
        daily_start = self.as_of - timedelta(days=TRAINING_STATUS_DAYS - 1)
        weekly_start = self.as_of - timedelta(days=TRAINING_STATUS_WEEKLY_DAYS - 1)
        self._probe_group(
            "daily training status",
            _TRAINING_FEATURES,
            lambda: self.client.get_training_status_daily(
                daily_start.isoformat(), self.as_of.isoformat()
            ),
            _training_status_summaries,
        )
        self._probe_group(
            "weekly training status",
            ("trainingStatusWeekly",),
            lambda: self.client.get_training_status_weekly(
                weekly_start.isoformat(), self.as_of.isoformat()
            ),
            lambda payload: {
                "trainingStatusWeekly": _dated_mapping_summary(normalize_status_report(_dict(payload)))
            },
        )

    def _probe_load_balance(self) -> None:
        self._probe_group(
            "training load balance",
            ("trainingLoadBalance",),
            lambda: self.client.get_training_load_balance(self.as_of.isoformat()),
            _load_balance_summary,
        )

    def _probe_race_predictions(self) -> None:
        start = self.as_of - timedelta(days=RACE_PREDICTION_DAYS - 1)
        self._probe_group(
            "race predictions",
            ("racePredictions",),
            lambda: self.client.get_race_predictions(start.isoformat(), self.as_of.isoformat()),
            lambda payload: {"racePredictions": _race_prediction_summary(payload)},
        )

    def _probe_gear(self) -> None:
        for status, feature in (("ACTIVE", "activeGear"), ("RETIRED", "retiredGear")):
            self._probe_group(
                f"{status.lower()} gear",
                (feature,),
                lambda s=status: self.client.get_gear_list(s),
                lambda payload, f=feature: {f: SampleSummary(len(_list(payload)))},
            )

    def _probe_training_plan(self) -> None:
        self._probe_group(
            "training plans",
            ("trainingPlan",),
            self.client.get_training_plans,
            _training_plan_summary,
        )

    def _probe_calendar(self) -> None:
        for year, month in _calendar_months(self.as_of, CALENDAR_MONTHS):
            self._probe_group(
                "calendar",
                ("plannedWorkouts", "upcomingRaces"),
                lambda y=year, m=month: self.client.get_calendar_month(y, m),
                _calendar_summaries,
            )

    def _probe_recent_activities(self) -> None:
        group = tuple(dict.fromkeys((*FIT_FEATURE_IDS, "activityHeartRateZones")))
        ok, payload = self._fetch(
            "recent running activities",
            lambda: self.client.get_activities(start=0, limit=ACTIVITY_LIMIT, running_only=True),
        )
        if not ok:
            self._fail_many(group, payload)
            return

        try:
            activities = _list(payload)
            if any(not isinstance(item, dict) or item.get("activityId") is None for item in activities):
                raise InvalidProbePayload("activity list has an invalid shape")
        except InvalidProbePayload:
            self._fail_many(group, "invalid_response")
            return

        if not activities:
            for feature in group:
                self.features[feature].success(0)
            return

        for activity in activities:
            activity_id = str(activity["activityId"])
            activity_date = _activity_date(activity)
            self._probe_one_fit(activity_id, activity_date)
            self._probe_one_activity_zones(activity_id, activity_date)

    def _probe_one_fit(self, activity_id: str, activity_date: str | None) -> None:
        ok, payload = self._fetch(
            "recent FIT file",
            lambda: self.client.download_fit(activity_id, strict_errors=True),
            stable_endpoint=False,
        )
        if not ok:
            self._fail_many(FIT_FEATURE_IDS, payload)
            return
        if not isinstance(payload, bytes):
            self._fail_many(FIT_FEATURE_IDS, "invalid_response")
            return
        try:
            observed = inspect_fit_capabilities(payload)
        except InvalidProbePayload:
            self._fail_many(FIT_FEATURE_IDS, "invalid_response")
            return
        for feature in FIT_FEATURE_IDS:
            count = 1 if feature in observed else 0
            self.features[feature].success(_one_sample(count, activity_date))

    def _probe_one_activity_zones(self, activity_id: str, activity_date: str | None) -> None:
        ok, payload = self._fetch(
            "activity heart-rate zones",
            lambda: self.client.get_hr_zones(activity_id, strict_errors=True),
            stable_endpoint=False,
        )
        if not ok:
            self.features["activityHeartRateZones"].failure(payload)
            return
        try:
            zones = _list(payload)
        except InvalidProbePayload:
            self.features["activityHeartRateZones"].failure("invalid_response")
            return
        self.features["activityHeartRateZones"].success(
            _one_sample(1 if zones else 0, activity_date)
        )

    def _probe_group(
        self,
        label: str,
        feature_ids: tuple[str, ...],
        fetch: Callable[[], Any],
        interpret: Callable[[Any], dict[str, SampleSummary]],
        *,
        stable_endpoint: bool = True,
    ) -> None:
        ok, value = self._fetch(label, fetch, stable_endpoint=stable_endpoint)
        if not ok:
            self._fail_many(feature_ids, value)
            return
        try:
            summaries = interpret(value)
            if set(summaries) != set(feature_ids):
                raise InvalidProbePayload("interpreter returned an incomplete feature set")
        except Exception:
            self._fail_many(feature_ids, "invalid_response")
            return
        for feature, summary in summaries.items():
            self.features[feature].success(summary)

    def _fail_many(self, feature_ids: tuple[str, ...], status: ProbeStatus) -> None:
        for feature in feature_ids:
            self.features[feature].failure(status)

    def _fetch(
        self,
        label: str,
        fetch: Callable[[], T],
        *,
        stable_endpoint: bool = True,
    ) -> tuple[bool, T | ProbeStatus]:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                return True, fetch()
            except GarminAPIError as exc:
                if exc.status_code == 401:
                    raise DiagnosticAuthError("Garmin authentication failed") from None
                if exc.status_code in (404, 410) and stable_endpoint:
                    return False, "unsupported"
                if exc.status_code == 429 or exc.status_code >= 500:
                    if attempt < MAX_ATTEMPTS:
                        self.log(f"{label}: temporary error, retrying ({attempt}/{MAX_ATTEMPTS - 1})")
                        self.sleep(60.0 if exc.status_code == 429 else 2.0 * (4 ** (attempt - 1)))
                        continue
                    return False, "temporary_error"
                return False, "invalid_response"
            except httpx.HTTPError:
                if attempt < MAX_ATTEMPTS:
                    self.log(f"{label}: temporary error, retrying ({attempt}/{MAX_ATTEMPTS - 1})")
                    self.sleep(2.0 * (4 ** (attempt - 1)))
                    continue
                return False, "temporary_error"
            except (TypeError, ValueError, KeyError):
                return False, "invalid_response"
            except Exception:
                # Never stringify an unknown exception: http clients commonly
                # include the request URL (and Garmin profile UUID) in it.
                return False, "invalid_response"
        return False, "temporary_error"


def _user_settings_summaries(payload: Any) -> dict[str, SampleSummary]:
    root = _dict(payload)
    user_data = root.get("userData")
    if not isinstance(user_data, dict):
        raise InvalidProbePayload("missing userData")
    return {
        "vo2max": SampleSummary(_present(user_data, "vo2MaxRunning", "vO2MaxRunning")),
        "lactateThresholdHeartRate": SampleSummary(_present(user_data, "lactateThresholdHeartRate")),
        "thresholdPace": SampleSummary(_present(user_data, "lactateThresholdSpeed")),
        "weight": SampleSummary(_present(user_data, "weight")),
        "height": SampleSummary(_present(user_data, "height")),
    }


def _zone_summaries(payload: Any) -> dict[str, SampleSummary]:
    zones = _list(payload)
    if any(not isinstance(zone, dict) for zone in zones):
        raise InvalidProbePayload("invalid zone list")
    selected = next((z for z in zones if z.get("sport") == "RUNNING"), None) or next(
        (z for z in zones if z.get("sport") == "DEFAULT"), None
    )
    selected = selected or {}
    floor_count = sum(1 for number in range(1, 6) if selected.get(f"zone{number}Floor") is not None)
    return {
        "heartRateZones": SampleSummary(floor_count),
        "restingHeartRate": SampleSummary(_present(selected, "restingHeartRateUsed")),
        "maxHeartRate": SampleSummary(_present(selected, "maxHeartRateUsed")),
    }


def _fitness_age_summaries(payload: Any) -> dict[str, SampleSummary]:
    rows = _list(payload)
    return {
        "fitnessAge": _nested_values_summary(rows, "fitnessAge"),
        "achievableFitnessAge": _nested_values_summary(rows, "achievableFitnessAge"),
        "bmi": _nested_values_summary(rows, "bmi"),
    }


def _max_met_summary(payload: Any) -> SampleSummary:
    rows = _list(payload)
    matching: list[tuple[str | None, bool]] = []
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("generic"), dict):
            raise InvalidProbePayload("invalid maxmet row")
        generic = row["generic"]
        matching.append(
            (
                _first_date(generic, "calendarDate"),
                _present(generic, "vo2MaxPreciseValue", "vo2MaxValue") > 0,
            )
        )
    return _summary_from_matches(matching)


def _threshold_summary(payload: Any) -> SampleSummary:
    rows = _list(payload)
    if any(
        not isinstance(row, dict)
        or not isinstance(row.get("from"), str)
        or "value" not in row
        for row in rows
    ):
        raise InvalidProbePayload("invalid threshold row")
    normalized = normalize_stat(rows)
    return _dated_mapping_summary(normalized)


def _training_status_summaries(payload: Any) -> dict[str, SampleSummary]:
    root = _dict(payload)
    report_data = root.get("reportData")
    if not isinstance(report_data, dict) or any(
        not isinstance(entries, list)
        or any(not isinstance(entry, dict) for entry in entries)
        for entries in report_data.values()
    ):
        raise InvalidProbePayload("invalid training-status report")
    days = normalize_status_report(root)
    return {
        "trainingStatus": _mapping_field_summary(days, "status"),
        "acuteTrainingLoad": _mapping_field_summary(days, "acuteLoad"),
        "chronicTrainingLoad": _mapping_field_summary(days, "chronicLoad"),
        "acwr": _mapping_field_summary(days, "acwr"),
    }


def _load_balance_summary(payload: Any) -> dict[str, SampleSummary]:
    root = _dict(payload)
    by_device = root.get("metricsTrainingLoadBalanceDTOMap")
    if not isinstance(by_device, dict) or any(
        not isinstance(entry, dict) for entry in by_device.values()
    ):
        raise InvalidProbePayload("invalid load-balance report")
    balance = normalize_load_balance(root)
    if not balance:
        return {"trainingLoadBalance": SampleSummary(0)}
    return {
        "trainingLoadBalance": _one_sample(1, _first_date(balance, "date")),
    }


def _race_prediction_summary(payload: Any) -> SampleSummary:
    rows = _list(payload)
    dates: list[str] = []
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("calendarDate"), str):
            raise InvalidProbePayload("invalid race-prediction row")
        normalized = normalize_prediction(row)
        if normalized:
            dates.append(normalized[0])
    return _summary_from_dates(dates, len(dates))


def _training_plan_summary(payload: Any) -> dict[str, SampleSummary]:
    root = _dict(payload)
    plans = root.get("trainingPlanList")
    if not isinstance(plans, list):
        raise InvalidProbePayload("missing trainingPlanList")
    return {"trainingPlan": SampleSummary(len(plans))}


def _calendar_summaries(payload: Any) -> dict[str, SampleSummary]:
    root = _dict(payload)
    items = root.get("calendarItems")
    if not isinstance(items, list):
        raise InvalidProbePayload("missing calendarItems")
    planned_dates: list[str] = []
    race_dates: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            raise InvalidProbePayload("invalid calendar item")
        item_date = _first_date(item, "date")
        item_type = item.get("itemType")
        sport = str(item.get("sport") or "").lower()
        if (
            item_date
            and item_type in ("workout", "fbtAdaptiveWorkout")
            and (not sport or "running" in sport)
        ):
            planned_dates.append(item_date)
        if item_date and item.get("isRace") is True:
            race_dates.append(item_date)
    return {
        "plannedWorkouts": _summary_from_dates(planned_dates, len(planned_dates)),
        "upcomingRaces": _summary_from_dates(race_dates, len(race_dates)),
    }


def _nested_values_summary(rows: list[Any], field: str) -> SampleSummary:
    matches: list[tuple[str | None, bool]] = []
    for row in rows:
        if not isinstance(row, dict):
            raise InvalidProbePayload("invalid fitness-age row")
        values = row.get("values")
        if values is None:
            values = {}
        if not isinstance(values, dict):
            raise InvalidProbePayload("invalid fitness-age values")
        matches.append(
            (
                _first_date(row, "calendarDate", "date"),
                field in values and values[field] is not None,
            )
        )
    return _summary_from_matches(matches)


def _mapping_field_summary(rows: dict[str, dict[str, Any]], field: str) -> SampleSummary:
    dates = [day for day, row in rows.items() if row.get(field) is not None]
    return _summary_from_dates(dates, len(dates))


def _dated_mapping_summary(rows: dict[str, Any]) -> SampleSummary:
    return _summary_from_dates(list(rows), len(rows))


def _summary_from_matches(matches: list[tuple[str | None, bool]]) -> SampleSummary:
    dates = [item_date for item_date, present in matches if present and item_date]
    count = sum(1 for _item_date, present in matches if present)
    return _summary_from_dates(dates, count)


def _summary_from_dates(dates: list[str], count: int) -> SampleSummary:
    safe = sorted({value[:10] for value in dates if _is_iso_date(value[:10])})
    return SampleSummary(
        count,
        first_sample_at=safe[0] if safe else None,
        last_sample_at=safe[-1] if safe else None,
    )


def _one_sample(count: int, item_date: str | None) -> SampleSummary:
    return SampleSummary(
        count,
        first_sample_at=item_date if count and item_date else None,
        last_sample_at=item_date if count and item_date else None,
    )


def _dict(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise InvalidProbePayload("expected object")
    return value


def _list(value: Any) -> list[Any]:
    if not isinstance(value, list):
        raise InvalidProbePayload("expected list")
    return value


def _present(mapping: dict[str, Any], *keys: str) -> int:
    return 1 if any(key in mapping and mapping[key] is not None for key in keys) else 0


def _first_date(mapping: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = mapping.get(key)
        if isinstance(value, str) and _is_iso_date(value[:10]):
            return value[:10]
    return None


def _activity_date(activity: dict[str, Any]) -> str | None:
    return _first_date(activity, "startTimeLocal", "calendarDate", "date")


def _is_iso_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
        return len(value) == 10
    except (TypeError, ValueError):
        return False


def _calendar_months(as_of: date, count: int) -> list[tuple[int, int]]:
    result: list[tuple[int, int]] = []
    year, month = as_of.year, as_of.month
    for offset in range(count):
        total = month - 1 + offset
        result.append((year + total // 12, total % 12 + 1))
    return result


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Probe Garmin feature availability without writing RunOmics production data"
    )
    parser.add_argument("--output", type=Path, required=True, help="Sanitized JSON report path")
    parser.add_argument(
        "--as-of",
        type=date.fromisoformat,
        default=date.today(),
        metavar="YYYY-MM-DD",
        help="Shared calendar date for every probe window",
    )
    parser.add_argument(
        "--previous-report",
        type=Path,
        default=None,
        help="Optional sanitized report whose support survives transient failures",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not secret:
        print("Error: GARMIN_SECRET is not set; no report was written.", file=sys.stderr)
        return 2

    try:
        previous = load_report(args.previous_report) if args.previous_report else None
    except Exception:
        print("Error: previous report is invalid; no report was written.", file=sys.stderr)
        return 2

    try:
        with GarminClient(secret) as client:
            report = ProbeRunner(client, as_of=args.as_of, previous_report=previous).run()
    except (GarminAuthError, DiagnosticAuthError):
        print("Error: Garmin authentication failed; no report was written.", file=sys.stderr)
        return 3
    except Exception:
        # Never include an exception string here. It may hold a URL, UUID or
        # token fragment supplied by an HTTP/authentication library.
        print("Error: capability probe failed safely; no report was written.", file=sys.stderr)
        return 4

    write_report_atomic(args.output, report)
    print("Sanitized capability report written.")
    for feature, state in report["features"].items():
        print(
            f"{feature}: {state['support']}; "
            f"probe={state['probeStatus']}; samples={state['samples']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
