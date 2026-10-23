"""Garmin serves only a few recent weeks whatever range is asked, and revises recent days: re-fetched days overwrite."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from data_directory import get_data_dir
from .client import GarminAPIError, GarminClient
from .retry import retry_transient
from repository.history_file import read_history_section, write_history

_DATA_DIR = get_data_dir()
_PATH = _DATA_DIR / "race_predictions.json"

# Wider than the window Garmin returns, so a long gap between syncs still gets everything on offer.
_LOOKBACK_DAYS = 120

_DISTANCES = {
    "time5K": "5k",
    "time10K": "10k",
    "timeHalfMarathon": "half",
    "timeMarathon": "marathon",
}


def normalize_prediction(entry: Any) -> tuple[str, dict[str, int]] | None:
    """Days before the watch had enough data come back with null keys; they are dropped, not stored as holes."""
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
    return read_history_section(_PATH, "days")


def merge_days(stored: dict[str, Any], payload: Any) -> int:
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

    write_history(_PATH, {"days": dict(sorted(stored.items()))})
    print(f"  {fetched} day(s) recorded, {len(stored)} total.")
    return len(stored)
