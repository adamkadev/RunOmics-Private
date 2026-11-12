"""Sync the owner's tracker readings from the Google Health API into health_history.json.

  daily-resting-heart-rate      beatsPerMinute                          -> restingHr
  daily-heart-rate-variability  averageHeartRateVariabilityMilliseconds -> hrvMs
  sleep                         the longest session ending that day     -> sleep
  steps (dailyRollUp)           countSum                                -> steps

Stored one entry per local date, a night under the day it ended:

  {"days": {"2026-11-11": {"restingHr": 49, "hrvMs": 88.3, "steps": 9120,
                           "sleep": {"start": "...", "end": "...", "asleepMinutes": 402, "awakeMinutes": 30,
                                     "deepMinutes": 71, "remMinutes": 96, "lightMinutes": 235}}}}

Only the tracker's own records count: the account also holds what a phone reports, whose resting heart rate
can be a workout's. Garmin's resting HR stays in recovery_history.json; the app reads this file in its place
from the first day it holds.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, timedelta
from typing import Any

from data_directory import get_data_dir
from repository.history_file import read_history, write_history

from .client import GoogleHealthClient

_OUT_PATH = get_data_dir() / "health_history.json"

_HISTORY_DAYS = 365
# A night or a day's total that the tracker revises once the phone syncs the next morning.
_REFRESH_DAYS = 7
_TRACKER_PLATFORM = "FITBIT"

_RESTING_HR_BPM = (30, 100)
_HRV_MS = (1.0, 300.0)
_STEPS = (0, 200_000)
_DAY_MINUTES = 24 * 60


def _number(value: Any) -> float | None:
    # The API sends 64-bit counts as JSON strings.
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _within(value: float | None, bounds: tuple[float, float]) -> bool:
    return value is not None and bounds[0] <= value <= bounds[1]


def _iso(civil: Any) -> str | None:
    if not isinstance(civil, dict):
        return None
    try:
        return date(int(civil["year"]), int(civil["month"]), int(civil["day"])).isoformat()
    except (KeyError, TypeError, ValueError):
        return None


def _from_tracker(point: dict) -> bool:
    source = point.get("dataSource")
    return isinstance(source, dict) and source.get("platform") == _TRACKER_PLATFORM


def normalize_resting_hr(points: Any) -> dict[str, int]:
    days: dict[str, int] = {}
    for point in points if isinstance(points, list) else []:
        if not isinstance(point, dict) or not _from_tracker(point):
            continue
        value = point.get("dailyRestingHeartRate")
        if not isinstance(value, dict):
            continue
        day, bpm = _iso(value.get("date")), _number(value.get("beatsPerMinute"))
        if day and _within(bpm, _RESTING_HR_BPM):
            days[day] = round(bpm)
    return days


def normalize_hrv(points: Any) -> dict[str, float]:
    days: dict[str, float] = {}
    for point in points if isinstance(points, list) else []:
        if not isinstance(point, dict) or not _from_tracker(point):
            continue
        value = point.get("dailyHeartRateVariability")
        if not isinstance(value, dict):
            continue
        day, ms = _iso(value.get("date")), _number(value.get("averageHeartRateVariabilityMilliseconds"))
        if day and _within(ms, _HRV_MS):
            days[day] = round(ms, 1)
    return days


def normalize_steps(rows: Any) -> dict[str, int]:
    days: dict[str, int] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        start = row.get("civilStartTime")
        day = _iso(start.get("date")) if isinstance(start, dict) else None
        steps = row.get("steps")
        count = _number(steps.get("countSum")) if isinstance(steps, dict) else None
        if day and _within(count, _STEPS):
            days[day] = round(count)
    return days


def _instant(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _offset(value: Any) -> timedelta:
    seconds = _number(value[:-1]) if isinstance(value, str) and value.endswith("s") else None
    return timedelta(seconds=seconds or 0)


def _session(point: dict) -> tuple[str, dict] | None:
    sleep = point.get("sleep")
    if not isinstance(sleep, dict):
        return None
    interval = sleep.get("interval") if isinstance(sleep.get("interval"), dict) else {}
    start, end = _instant(interval.get("startTime")), _instant(interval.get("endTime"))
    if start is None or end is None or end <= start:
        return None

    stages: dict[str, int] = {}
    for stage in sleep.get("stages") or []:
        if not isinstance(stage, dict):
            continue
        a, b = _instant(stage.get("startTime")), _instant(stage.get("endTime"))
        if a and b and b > a and isinstance(stage.get("type"), str):
            stages[stage["type"]] = stages.get(stage["type"], 0) + round((b - a).total_seconds() / 60)

    summary = sleep.get("summary") if isinstance(sleep.get("summary"), dict) else {}
    asleep = _number(summary.get("minutesAsleep"))
    awake = _number(summary.get("minutesAwake"))
    if asleep is None and stages:
        asleep = sum(minutes for kind, minutes in stages.items() if kind != "AWAKE")
        awake = stages.get("AWAKE", 0)
    if not _within(asleep, (1, _DAY_MINUTES)):
        return None

    night: dict[str, Any] = {
        "start": interval["startTime"],
        "end": interval["endTime"],
        "asleepMinutes": round(asleep),
        "awakeMinutes": round(awake) if _within(awake, (0, _DAY_MINUTES)) else 0,
    }
    for kind, key in (("DEEP", "deepMinutes"), ("REM", "remMinutes"), ("LIGHT", "lightMinutes")):
        if kind in stages:
            night[key] = stages[kind]
    woke = (end + _offset(interval.get("endUtcOffset"))).date().isoformat()
    return woke, night


def normalize_sleep(points: Any) -> dict[str, dict]:
    """The longest session ending on each local day: a nap the same day is not the night."""
    days: dict[str, dict] = {}
    for point in points if isinstance(points, list) else []:
        if not isinstance(point, dict) or not _from_tracker(point):
            continue
        session = _session(point)
        if session is None:
            continue
        day, night = session
        if day not in days or night["asleepMinutes"] > days[day]["asleepMinutes"]:
            days[day] = night
    return days


def merge_days(stored: dict[str, Any], fetched: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Each fetched field laid over the stored day; a field this fetch did not return keeps its stored value."""
    merged = {day: dict(fields) for day, fields in stored.items() if isinstance(fields, dict)}
    for field, by_day in fetched.items():
        for day, value in by_day.items():
            merged.setdefault(day, {})[field] = value
    return {day: dict(sorted(fields.items())) for day, fields in sorted(merged.items()) if fields}


def fetch_start(stored: dict[str, Any], today: date) -> date:
    if not stored:
        return today - timedelta(days=_HISTORY_DAYS - 1)
    return min(date.fromisoformat(max(stored)), today) - timedelta(days=_REFRESH_DAYS)


def sync_health_history(client: GoogleHealthClient, *, dry_run: bool = False, today: date | None = None) -> int:
    """Merge the tracker's readings into health_history.json; returns the day count stored.

    Each data type is fetched on its own, so one refused leaves the others written; the step still fails.
    """
    today = today or date.today()
    stored = read_history(_OUT_PATH).get("days") or {}
    start = fetch_start(stored, today)
    # The tracker dates by the athlete's zone, which can be a day ahead of the runner's UTC.
    end = today + timedelta(days=2)

    fetches: dict[str, Callable[[], dict]] = {
        "restingHr": lambda: normalize_resting_hr(client.list_points("daily-resting-heart-rate", "date", start, end)),
        "hrvMs": lambda: normalize_hrv(client.list_points("daily-heart-rate-variability", "date", start, end)),
        "sleep": lambda: normalize_sleep(
            client.list_points("sleep", "interval.civil_end_time", start, end, wearables_only=False)
        ),
        "steps": lambda: normalize_steps(client.daily_steps(start, end)),
    }
    fetched: dict[str, dict[str, Any]] = {}
    refused: list[str] = []
    for field, fetch in fetches.items():
        try:
            fetched[field] = fetch()
        except Exception as exc:
            print(f"  Google Health {field}: {exc}")
            refused.append(field)

    # The Actions log is world-readable: counts, never a reading.
    counts = ", ".join(f"{len(days)} {field}" for field, days in fetched.items())
    print(f"Google Health {start} … {today}: {counts or 'nothing fetched'}.")

    days = merge_days(stored, fetched)
    if dry_run:
        print(f"  Dry run: health_history.json would hold {len(days)} day(s); nothing written.")
    else:
        write_history(_OUT_PATH, {"days": days})
        print(f"  health_history.json now holds {len(days)} day(s).")
    if refused:
        raise RuntimeError(f"Google Health refused {', '.join(refused)}")
    return len(days)
