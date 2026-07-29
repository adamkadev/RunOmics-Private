"""Sync Garmin's lactate-threshold series to public/data/threshold_history.json.

  biometric-service/stats/lactateThresholdHeartRate/range/{start}/{end}
  biometric-service/stats/lactateThresholdSpeed/range/{start}/{end}

Unlike user-settings, which only carries the current threshold, this range
endpoint serves the history - so the trend is backfillable rather than starting
the day the sync began snapshotting it (see athlete.py's record_athlete_history,
which stays as the fallback for anything predating this).

Records are spans, not days: Garmin revises the threshold every few weeks and
returns one entry per revision, keyed here on the day it took effect.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from .client import GarminAPIError, GarminClient
from .retry import retry_transient
from .vo2max_history import monthly_windows

_OUT_PATH = Path(__file__).parent.parent.parent / "public" / "data" / "threshold_history.json"

_HR_METRIC = "lactateThresholdHeartRate"
_SPEED_METRIC = "lactateThresholdSpeed"


def normalize_stat(entries: Any) -> dict[str, float]:
    """Garmin's span records as {day the value took effect: value}."""
    samples: dict[str, float] = {}

    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        day = entry.get("from")
        value = entry.get("value")
        if day and value:
            samples[day] = float(value)

    return samples


def _fetch_metric(client: GarminClient, metric: str, start: date, today: date) -> dict[str, float]:
    samples: dict[str, float] = {}

    for window_start, window_end in monthly_windows(start, today):
        try:
            payload = retry_transient(
                lambda: client.get_biometric_stat(
                    metric, window_start.isoformat(), window_end.isoformat()
                )
            )
        except GarminAPIError as exc:
            print(f"  Warning: {metric} {window_start:%Y-%m}…{window_end:%Y-%m} failed: {exc}")
            continue
        samples.update(normalize_stat(payload))

    return samples


def build_days(hr: dict[str, float], speed: dict[str, float]) -> dict[str, dict[str, Any]]:
    """One entry per day either metric moved, each field present only if measured."""
    days: dict[str, dict[str, Any]] = {}

    for day in sorted(set(hr) | set(speed)):
        sample: dict[str, Any] = {"date": day}
        if day in hr:
            sample["lthrBpm"] = round(hr[day])
        if day in speed:
            # Same conversion as athlete.py: Garmin's threshold speed maps to
            # seconds per kilometre through 100 / speed.
            sample["thresholdPaceSecPerKm"] = round(100 / speed[day])
        days[day] = sample

    return days


def _load_stored() -> dict[str, dict[str, Any]]:
    if not _OUT_PATH.exists():
        return {}
    try:
        return json.loads(_OUT_PATH.read_text()).get("days") or {}
    except Exception:
        return {}


def sync_threshold_history(client: GarminClient, start: date, today: date | None = None) -> int:
    """Merge the lactate-threshold series into threshold_history.json.

    Returns the day count. Merged over what is stored rather than replacing it,
    so anything Garmin ages out of its retention window stays in ours.
    """
    today = today or date.today()
    print("Syncing lactate threshold history…")

    fetched = build_days(
        _fetch_metric(client, _HR_METRIC, start, today),
        _fetch_metric(client, _SPEED_METRIC, start, today),
    )
    days = {**_load_stored(), **fetched}

    if not days:
        print("  No threshold samples returned.")
        return 0

    _OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    _OUT_PATH.write_text(json.dumps({"days": dict(sorted(days.items()))}, indent=2) + "\n")

    latest = days[max(days)]
    print(
        f"  {len(days)} day(s) stored, latest "
        f"{latest.get('lthrBpm', '?')} bpm / {latest.get('thresholdPaceSecPerKm', '?')} s/km."
    )
    return len(days)
