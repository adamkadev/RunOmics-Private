from __future__ import annotations

from datetime import date
from typing import Any

from data_directory import get_data_dir
from .client import GarminAPIError, GarminClient
from .retry import retry_transient
from .step_warnings import warn
from .vo2max_history import monthly_windows
from repository.history_file import read_history_section, write_history

_OUT_PATH = get_data_dir() / "threshold_history.json"

_HR_METRIC = "lactateThresholdHeartRate"
_SPEED_METRIC = "lactateThresholdSpeed"


def normalize_stat(entries: Any) -> dict[str, float]:
    """Garmin returns one span per threshold revision; it is keyed on the day it took effect."""
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
                client.get_biometric_stat, metric, window_start.isoformat(), window_end.isoformat()
            )
        except GarminAPIError as exc:
            warn("threshold history", f"{metric} {window_start:%Y-%m}…{window_end:%Y-%m} failed: {exc}")
            continue
        samples.update(normalize_stat(payload))

    return samples


def build_days(hr: dict[str, float], speed: dict[str, float]) -> dict[str, dict[str, Any]]:
    days: dict[str, dict[str, Any]] = {}

    for day in sorted(set(hr) | set(speed)):
        sample: dict[str, Any] = {"date": day}
        if day in hr:
            sample["lthrBpm"] = round(hr[day])
        if day in speed:
            # Same conversion as athlete.py: Garmin's threshold speed gives s/km as 100 / speed.
            sample["thresholdPaceSecPerKm"] = round(100 / speed[day])
        days[day] = sample

    return days


def _load_stored() -> dict[str, dict[str, Any]]:
    return read_history_section(_OUT_PATH, "days")


def sync_threshold_history(client: GarminClient, start: date, today: date | None = None) -> int:
    """Merged over what is stored, so what Garmin ages out of its retention window stays in ours."""
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

    write_history(_OUT_PATH, {"days": dict(sorted(days.items()))})

    latest = days[max(days)]
    print(
        f"  {len(days)} day(s) stored, latest "
        f"{latest.get('lthrBpm', '?')} bpm / {latest.get('thresholdPaceSecPerKm', '?')} s/km."
    )
    return len(days)
