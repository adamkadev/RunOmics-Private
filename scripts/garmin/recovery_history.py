"""Sync the daily resting heart rate: the Form card's and the coach read's recovery reading.

  Personal API   usersummary-service/v2/dailysummaries            heartRate.restingValue per day
  Connect        userstats-service/wellness/daily/{profileUuid}   metric 60, without a Personal API key

Stored as recovery_history.json, one entry per calendar date:

  {"days": {"2026-09-25": {"restingHr": 46}}}

`restingHr` is the day's resting heart rate in bpm, missing on a day the
watch was not worn. HRV was dropped: neither athlete sleeps with the watch
on, so Garmin recorded it a handful of nights a year. A file written before
keeps its `hrv` fields until the next sync rewrites it without them.

Only the last year is fetched, which is the longest period the app plots.
Days already stored are skipped, except the trailing refresh window, which
Garmin fills in late when the watch syncs the next morning.
"""

from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Any

from data_directory import get_data_dir
from .client import GarminClient
from .errors import GarminAPIError
from .personal_api import PersonalApiClient
from .retry import retry_transient
from .step_warnings import warn
from .training_status import dates_to_fetch, fetch_windows
from repository.history_file import read_history, write_history

_OUT_PATH = get_data_dir() / "recovery_history.json"

_HISTORY_DAYS = 365
_RATE_LIMIT_PAUSE = 1.0
# A resting heart rate a person can have. Garmin's daily value carries
# workout readings on some days (142 and 144 bpm in Aug 2026), which the
# Recovery baseline then took for resting.
_RESTING_HR_BPM = (30, 100)


def _resting(iso: Any, value: Any) -> tuple[str, int] | None:
    if not isinstance(iso, str) or not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    bpm = round(value)
    return (iso, bpm) if _RESTING_HR_BPM[0] <= bpm <= _RESTING_HR_BPM[1] else None


def normalize_daily_summaries(rows: Any) -> dict[str, int]:
    """Resting heart rates keyed by date, from the Personal API's daily summaries."""
    days: dict[str, int] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        heart_rate = row.get("heartRate")
        day = _resting(row.get("calendarDate"), heart_rate.get("restingValue") if isinstance(heart_rate, dict) else None)
        if day:
            days[day[0]] = day[1]
    return days


def normalize_resting_hr(payload: Any) -> dict[str, int]:
    """Resting heart rates keyed by date, from Connect's wellness metric 60 response."""
    if not isinstance(payload, dict):
        return {}
    metrics = (payload.get("allMetrics") or {}).get("metricsMap") or {}
    entries = metrics.get("WELLNESS_RESTING_HEART_RATE")

    days: dict[str, int] = {}
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        day = _resting(entry.get("calendarDate"), entry.get("value"))
        if day:
            days[day[0]] = day[1]
    return days


def merge_days(stored: dict[str, Any], resting: dict[str, int]) -> dict[str, Any]:
    """The stored resting HRs with the fetched ones laid over them, by date.

    A day missing from this fetch keeps the value already stored; whatever
    else an older file holds for a day (its `hrv`) is dropped.
    """
    merged = {
        iso: {"restingHr": day["restingHr"]}
        for iso, day in stored.items()
        if isinstance(day, dict) and isinstance(day.get("restingHr"), int)
    }
    for iso, bpm in resting.items():
        merged[iso] = {"restingHr": bpm}
    return dict(sorted(merged.items()))


def _fetch_resting_hr(client: GarminClient | PersonalApiClient, window_start: date, window_end: date) -> dict[str, int] | None:
    """One window's resting HRs; None when Garmin refused it."""
    start, end = window_start.isoformat(), window_end.isoformat()
    try:
        if isinstance(client, PersonalApiClient):
            return normalize_daily_summaries(retry_transient(client.get_daily_summaries, start, end))
        return normalize_resting_hr(retry_transient(client.get_resting_hr_range, start, end))
    except GarminAPIError as exc:
        warn("recovery history", f"resting HR {window_start}…{window_end} failed: {exc}")
        return None


def sync_recovery_history(client: GarminClient | PersonalApiClient, today: date | None = None) -> int:
    """Merge the last year of resting HR into recovery_history.json.

    Returns the day count stored.
    """
    today = today or date.today()
    stored = read_history(_OUT_PATH).get("days") or {}
    start = today - timedelta(days=_HISTORY_DAYS - 1)
    windows = fetch_windows(dates_to_fetch(start, today, stored))

    print(f"Syncing resting HR over {len(windows)} window(s)…")
    resting: dict[str, int] = {}
    refused = 0
    for window_start, window_end in windows:
        fetched = _fetch_resting_hr(client, window_start, window_end)
        if fetched is None:
            refused += 1
        else:
            resting.update(fetched)
        time.sleep(_RATE_LIMIT_PAUSE)
    days = merge_days(stored, resting)
    write_history(_OUT_PATH, {"days": days})
    print(f"  {len(resting)} resting HR day(s) recorded, {len(days)} total.")
    # What was fetched is written; a refused window still fails the step, as
    # in every other one, so a refusal that lasts is seen rather than leaving
    # the reading stale without a word.
    if refused:
        raise RuntimeError(f"Garmin refused {refused} of {len(windows)} resting HR window(s)")
    return len(days)
