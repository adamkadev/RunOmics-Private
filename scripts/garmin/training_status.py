"""Garmin's `weekly` and `monthly` status reports name the view, not the granularity (one record per day / per week).

The weekly rollup is stored rather than re-derived, because voting on the days does not reproduce Garmin's week
boundary or its choice of sample.
"""

from __future__ import annotations

import re
import time
from datetime import date, timedelta
from typing import Any

from data_directory import get_data_dir
from .client import GarminAPIError, GarminClient
from .retry import retry_transient
from repository.history_file import read_history, write_history

_DATA_DIR = get_data_dir()
_STATUS_PATH = _DATA_DIR / "training_status.json"
_BALANCE_PATH = _DATA_DIR / "training_load_balance.json"

_RATE_LIMIT_PAUSE = 1.0
# Stored days re-fetched anyway: Garmin revises the most recent ones as later activities land.
_REFRESH_WINDOW_DAYS = 7
# Garmin's own front-end never asks the daily report for more than four weeks,
# nor the weekly one for more than six months.
_WINDOW_DAYS = 28
_WEEKLY_WINDOW_DAYS = 182


def _primary_device(by_device: Any) -> dict[str, Any] | None:
    """TODO: on a watch change, key the stored days by device id so the switch is not a discontinuity in one series."""
    if not isinstance(by_device, dict):
        return None

    entries = [entry for entry in by_device.values() if isinstance(entry, dict)]
    for entry in entries:
        if entry.get("primaryTrainingDevice"):
            return entry
    return entries[0] if entries else None


def _primary_device_series(report_data: Any) -> list[dict[str, Any]]:
    if not isinstance(report_data, dict):
        return []

    series = [
        [entry for entry in entries if isinstance(entry, dict)]
        for entries in report_data.values()
        if isinstance(entries, list)
    ]
    for entries in series:
        if any(entry.get("primaryTrainingDevice") for entry in entries):
            return entries
    return series[0] if series else []


def _status_label(phrase: Any) -> str | None:
    """`RECOVERY_2` -> `recovery`: the numeric `trainingStatus` code is undocumented, the phrase is stable."""
    if not isinstance(phrase, str) or not phrase:
        return None
    return re.sub(r"_\d+$", "", phrase).lower()


def _load(value: Any) -> int | None:
    return round(value) if isinstance(value, (int, float)) else None


def _flatten_day(entry: dict[str, Any]) -> dict[str, Any] | None:
    acute = entry.get("acuteTrainingLoadDTO") or {}
    day = {
        "status": _status_label(entry.get("trainingStatusFeedbackPhrase")),
        "statusCode": entry.get("trainingStatus"),
        "feedback": entry.get("trainingStatusFeedbackPhrase"),
        "fitnessTrend": entry.get("fitnessTrend"),
        "acuteLoad": _load(acute.get("dailyTrainingLoadAcute")),
        "chronicLoad": _load(acute.get("dailyTrainingLoadChronic")),
        "acwr": acute.get("dailyAcuteChronicWorkloadRatio"),
        "acwrStatus": acute.get("acwrStatus"),
        "chronicLoadMin": _load(acute.get("minTrainingLoadChronic")),
        "chronicLoadMax": _load(acute.get("maxTrainingLoadChronic")),
    }

    # A day with no load and no status is a day the watch was not worn, not a real zero.
    if day["status"] is None and day["acuteLoad"] is None:
        return None

    return {key: value for key, value in day.items() if value is not None}


def normalize_status_report(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    days: dict[str, dict[str, Any]] = {}

    for entry in _primary_device_series(payload.get("reportData")):
        iso = entry.get("calendarDate")
        day = _flatten_day(entry)
        if iso and day:
            days[iso] = day

    return days


def normalize_load_balance(payload: dict[str, Any]) -> dict[str, Any] | None:
    entry = _primary_device(payload.get("metricsTrainingLoadBalanceDTOMap"))
    if entry is None:
        return None

    balance = {
        "date": entry.get("calendarDate"),
        "feedback": entry.get("trainingBalanceFeedbackPhrase"),
        "aerobicLow": _load(entry.get("monthlyLoadAerobicLow")),
        "aerobicLowMin": _load(entry.get("monthlyLoadAerobicLowTargetMin")),
        "aerobicLowMax": _load(entry.get("monthlyLoadAerobicLowTargetMax")),
        "aerobicHigh": _load(entry.get("monthlyLoadAerobicHigh")),
        "aerobicHighMin": _load(entry.get("monthlyLoadAerobicHighTargetMin")),
        "aerobicHighMax": _load(entry.get("monthlyLoadAerobicHighTargetMax")),
        "anaerobic": _load(entry.get("monthlyLoadAnaerobic")),
        "anaerobicMin": _load(entry.get("monthlyLoadAnaerobicTargetMin")),
        "anaerobicMax": _load(entry.get("monthlyLoadAnaerobicTargetMax")),
    }

    if balance["aerobicLow"] is None and balance["aerobicHigh"] is None:
        return None

    return {key: value for key, value in balance.items() if value is not None}


def _load_stored() -> tuple[dict[str, Any], dict[str, Any]]:
    stored = read_history(_STATUS_PATH)
    return stored.get("days") or {}, stored.get("weeks") or {}


def dates_to_fetch(start: date, today: date, stored: dict[str, Any]) -> list[date]:
    refresh_from = today - timedelta(days=_REFRESH_WINDOW_DAYS)
    days: list[date] = []
    current = start
    while current <= today:
        if current.isoformat() not in stored or current >= refresh_from:
            days.append(current)
        current += timedelta(days=1)
    return days


def fetch_windows(days: list[date]) -> list[tuple[date, date]]:
    """A range costs one request whatever it spans, so stored days inside one ride along for free."""
    windows: list[tuple[date, date]] = []

    for day in days:
        last = windows[-1] if windows else None
        if last and (day - last[0]).days < _WINDOW_DAYS:
            windows[-1] = (last[0], day)
        else:
            windows.append((day, day))

    return windows


def weekly_windows(start: date, today: date, stored: dict[str, Any]) -> list[tuple[date, date]]:
    """Garmin revises the week in progress as sessions land, but closed weeks never move, so only the tail is re-fetched."""
    latest = max(stored) if stored else None
    first = (
        max(start, date.fromisoformat(latest) - timedelta(days=_REFRESH_WINDOW_DAYS))
        if latest
        else start
    )

    windows: list[tuple[date, date]] = []
    cursor = first
    while cursor <= today:
        window_end = min(cursor + timedelta(days=_WEEKLY_WINDOW_DAYS - 1), today)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)

    return windows


def _fetch_days(client: GarminClient, windows: list[tuple[date, date]]) -> dict[str, Any]:
    days: dict[str, Any] = {}

    for window_start, window_end in windows:
        try:
            payload = retry_transient(
                client.get_training_status_daily, window_start.isoformat(), window_end.isoformat()
            )
        except GarminAPIError as exc:
            print(f"  Warning: training status {window_start}…{window_end} failed: {exc}")
            continue

        days.update(normalize_status_report(payload))
        time.sleep(_RATE_LIMIT_PAUSE)

    return days


def _fetch_weeks(client: GarminClient, windows: list[tuple[date, date]]) -> dict[str, Any]:
    weeks: dict[str, Any] = {}

    for window_start, window_end in windows:
        try:
            payload = retry_transient(
                client.get_training_status_weekly, window_start.isoformat(), window_end.isoformat()
            )
        except GarminAPIError as exc:
            print(f"  Warning: weekly training status {window_start}…{window_end} failed: {exc}")
            continue

        weeks.update(normalize_status_report(payload))
        time.sleep(_RATE_LIMIT_PAUSE)

    return weeks


def sync_training_status(client: GarminClient, start: date, today: date | None = None) -> int:
    today = today or date.today()
    stored_days, stored_weeks = _load_stored()

    day_windows = fetch_windows(dates_to_fetch(start, today, stored_days))
    week_windows = weekly_windows(start, today, stored_weeks)

    print(f"Syncing training status over {len(day_windows) + len(week_windows)} window(s)…")
    fetched_days = _fetch_days(client, day_windows)
    fetched_weeks = _fetch_weeks(client, week_windows)

    days = {**stored_days, **fetched_days}
    weeks = {**stored_weeks, **fetched_weeks}

    write_history(_STATUS_PATH, {"days": dict(sorted(days.items())), "weeks": dict(sorted(weeks.items()))})
    print(
        f"  {len(fetched_days)} day(s) and {len(fetched_weeks)} week(s) recorded, "
        f"{len(days)} day(s) total."
    )
    return len(days)


def sync_load_balance(client: GarminClient, today: date | None = None) -> bool:
    iso = (today or date.today()).isoformat()
    print("Syncing training load balance…")
    try:
        payload = retry_transient(lambda: client.get_training_load_balance(iso))
    except GarminAPIError as exc:
        print(f"  Warning: training load balance fetch failed: {exc}")
        return False

    balance = normalize_load_balance(payload)
    if balance is None:
        print("  No load balance recorded for today.")
        return False

    write_history(_BALANCE_PATH, dict(sorted(balance.items())))
    print(f"  {balance.get('feedback', 'written')}")
    return True
