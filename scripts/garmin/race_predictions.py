"""Sync Garmin's own race time predictions.

  metrics-service/metrics/racepredictions/daily/{profileUuid}
      ?fromCalendarDate=…&toCalendarDate=…

Firstbeat re-estimates a finish time for 5 km, 10 km, half and full marathon
from VO2max and recent training, one record per day. RunOmics has no way to
derive these - our own best-effort table only knows distances actually raced -
so this is the one Garmin series with no local equivalent at all.

Garmin only serves a few recent weeks whatever range is asked for, so there is
nothing to backfill: one request per sync for a generous window is enough, and
the stored file accumulates the history run after run. Re-fetched days overwrite
stored ones, since Garmin revises recent estimates as new activities land.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from .client import GarminAPIError, GarminClient
from .retry import retry_transient

_DATA_DIR = Path(__file__).parent.parent.parent / "public" / "data"
_PATH = _DATA_DIR / "race_predictions.json"

# Comfortably wider than the window Garmin actually returns, so a long gap
# between syncs still picks up everything on offer.
_LOOKBACK_DAYS = 120

# Garmin's field names, in the order we want them stored.
_DISTANCES = {
    "time5K": "5k",
    "time10K": "10k",
    "timeHalfMarathon": "half",
    "timeMarathon": "marathon",
}


def normalize_prediction(entry: Any) -> tuple[str, dict[str, int]] | None:
    """One day's predictions as `(date, {distance: seconds})`.

    Days before the watch had enough data come back with the keys present but
    null; those are not a prediction and are dropped rather than stored as a
    hole in the series.
    """
    if not isinstance(entry, dict):
        return None

    day = entry.get("calendarDate")
    if not day:
        return None

    times = {}
    for field, key in _DISTANCES.items():
        seconds = entry.get(field)
        if isinstance(seconds, (int, float)) and seconds > 0:
            times[key] = round(seconds)

    return (day, times) if times else None


def _load_days() -> dict[str, Any]:
    if not _PATH.exists():
        return {}
    try:
        return json.loads(_PATH.read_text()).get("days") or {}
    except Exception:
        return {}


def merge_days(stored: dict[str, Any], payload: Any) -> int:
    """Fold one response into the stored days. Returns how many days it carried."""
    fetched = 0
    for entry in payload or []:
        normalized = normalize_prediction(entry)
        if normalized is None:
            continue
        day, times = normalized
        stored[day] = times
        fetched += 1
    return fetched


def sync_race_predictions(client: GarminClient, today: date | None = None) -> int:
    """Merge the window Garmin offers into race_predictions.json. Returns the day count stored."""
    today = today or date.today()
    start = today - timedelta(days=_LOOKBACK_DAYS)
    stored = _load_days()

    print("Syncing race predictions…")
    try:
        payload = retry_transient(
            lambda: client.get_race_predictions(start.isoformat(), today.isoformat())
        )
    except GarminAPIError as exc:
        print(f"  Warning: race predictions fetch failed: {exc}")
        return len(stored)

    fetched = merge_days(stored, payload)

    if not stored:
        print("  No race predictions recorded.")
        return 0

    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _PATH.write_text(json.dumps({"days": dict(sorted(stored.items()))}, indent=2) + "\n")
    print(f"  {fetched} day(s) recorded, {len(stored)} total.")
    return len(stored)
