"""Sync overnight HRV and resting heart rate: the Recovery card's two series.

  hrv-service/hrv/daily/{start}/{end}              one summary per night
  hrv-service/hrv/{date}                           one night, the fallback
  userstats-service/wellness/daily/{profileUuid}   metric 60, resting HR per day

Stored as recovery_history.json, one entry per calendar date:

  {"days": {"2026-09-25": {"hrv": 61, "restingHr": 46}}}

`hrv` is Garmin's last-night average in ms and `restingHr` the day's resting
heart rate in bpm; either may be missing on a night the watch was not worn.
Garmin's own HRV baseline is not stored: the card draws the athlete's own
60-day range instead.

Only the last year is fetched, which is the longest period the card plots.
Nights already stored are skipped, except the trailing refresh window, which
Garmin fills in late when the watch syncs the next morning.
"""

from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Any

from data_directory import get_data_dir
from .client import GarminAPIError, GarminClient
from .retry import retry_transient
from .training_status import dates_to_fetch, fetch_windows
from repository.history_file import read_history, write_history

_OUT_PATH = get_data_dir() / "recovery_history.json"

_HISTORY_DAYS = 365
_RATE_LIMIT_PAUSE = 1.0


def _whole(value: Any) -> int | None:
    return round(value) if isinstance(value, (int, float)) and value > 0 else None


def normalize_hrv(payload: Any) -> dict[str, int]:
    """Last-night HRV averages keyed by date, from a range or a one-night response."""
    if not isinstance(payload, dict):
        return {}
    summaries = payload.get("hrvSummaries")
    if not isinstance(summaries, list):
        one = payload.get("hrvSummary")
        summaries = [one] if isinstance(one, dict) else []

    nights: dict[str, int] = {}
    for summary in summaries:
        if not isinstance(summary, dict):
            continue
        iso = summary.get("calendarDate")
        hrv = _whole(summary.get("lastNightAvg"))
        if iso and hrv is not None:
            nights[iso] = hrv
    return nights


def normalize_resting_hr(payload: Any) -> dict[str, int]:
    """Resting heart rates keyed by date, from the wellness metric 60 response."""
    if not isinstance(payload, dict):
        return {}
    metrics = (payload.get("allMetrics") or {}).get("metricsMap") or {}
    entries = metrics.get("WELLNESS_RESTING_HEART_RATE")

    days: dict[str, int] = {}
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        iso = entry.get("calendarDate")
        bpm = _whole(entry.get("value"))
        if iso and bpm is not None:
            days[iso] = bpm
    return days


def merge_nights(stored: dict[str, Any], hrv: dict[str, int], resting: dict[str, int]) -> dict[str, Any]:
    """The stored nights with the fetched values laid over them, one field at a time.

    A fetch that returned HRV but no resting HR for a night keeps the resting HR
    already stored, rather than dropping it.
    """
    merged: dict[str, dict[str, int]] = {iso: dict(night) for iso, night in stored.items() if isinstance(night, dict)}
    for iso, value in hrv.items():
        merged.setdefault(iso, {})["hrv"] = value
    for iso, value in resting.items():
        merged.setdefault(iso, {})["restingHr"] = value
    return dict(sorted((iso, night) for iso, night in merged.items() if night))


def _fetch_hrv(client: GarminClient, window_start: date, window_end: date) -> dict[str, int]:
    try:
        return normalize_hrv(
            retry_transient(client.get_hrv_range, window_start.isoformat(), window_end.isoformat())
        )
    except GarminAPIError as exc:
        print(f"  Warning: HRV {window_start}…{window_end} failed ({exc}); trying night by night")

    nights: dict[str, int] = {}
    day = window_start
    while day <= window_end:
        try:
            nights.update(normalize_hrv(retry_transient(client.get_hrv_night, day.isoformat())))
        except GarminAPIError:
            pass
        day += timedelta(days=1)
        time.sleep(_RATE_LIMIT_PAUSE)
    return nights


def _fetch_resting_hr(client: GarminClient, window_start: date, window_end: date) -> dict[str, int]:
    try:
        return normalize_resting_hr(
            retry_transient(client.get_resting_hr_range, window_start.isoformat(), window_end.isoformat())
        )
    except GarminAPIError as exc:
        print(f"  Warning: resting HR {window_start}…{window_end} failed: {exc}")
        return {}


def sync_recovery_history(client: GarminClient, today: date | None = None) -> int:
    """Merge the last year of HRV and resting HR into recovery_history.json.

    Returns the night count stored.
    """
    today = today or date.today()
    stored = read_history(_OUT_PATH).get("days") or {}
    start = today - timedelta(days=_HISTORY_DAYS - 1)
    windows = fetch_windows(dates_to_fetch(start, today, stored))

    print(f"Syncing HRV and resting HR over {len(windows)} window(s)…")
    hrv: dict[str, int] = {}
    resting: dict[str, int] = {}
    for window_start, window_end in windows:
        hrv.update(_fetch_hrv(client, window_start, window_end))
        resting.update(_fetch_resting_hr(client, window_start, window_end))
        time.sleep(_RATE_LIMIT_PAUSE)

    days = merge_nights(stored, hrv, resting)
    write_history(_OUT_PATH, {"days": days})
    print(f"  {len(hrv)} HRV night(s) and {len(resting)} resting HR day(s) recorded, {len(days)} total.")
    return len(days)
