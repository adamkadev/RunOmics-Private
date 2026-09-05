"""Normalize Garmin's 52-week Fitness Age series without storing raw payloads."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

import httpx

from data_directory import get_data_dir
from .client import GarminAPIError, GarminClient
from .retry import retry_transient

_PATH = get_data_dir() / "fitness_age_history.json"
_WEEKS = 52


def normalize_weekly_fitness_age(rows: Any) -> dict[str, dict[str, Any]]:
    weeks: dict[str, dict[str, Any]] = {}
    if not isinstance(rows, list):
        return weeks

    for row in rows:
        if not isinstance(row, dict):
            continue
        calendar_date = row.get("calendarDate")
        values = row.get("values")
        if not isinstance(calendar_date, str) or not isinstance(values, dict):
            continue
        try:
            normalized_date = date.fromisoformat(calendar_date[:10]).isoformat()
        except ValueError:
            continue

        sample: dict[str, Any] = {}
        for source, target in (
            ("fitnessAge", "fitnessAgeYrs"),
            ("achievableFitnessAge", "achievableFitnessAgeYrs"),
            ("bmi", "bmi"),
        ):
            value = values.get(source)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                sample[target] = round(value, 1)

        # The weekly payload also contains an RHR derivative. It is
        # intentionally excluded: canonical RHR comes from the HR-zone config.
        if sample:
            weeks[normalized_date] = sample

    return dict(sorted(weeks.items()))


def _load_existing() -> dict[str, dict[str, Any]]:
    if not _PATH.exists():
        return {}
    try:
        payload = json.loads(_PATH.read_text())
    except Exception:
        return {}
    weeks = payload.get("weeks") if isinstance(payload, dict) else None
    return weeks if isinstance(weeks, dict) else {}


def sync_fitness_age_history(client: GarminClient, today: date | None = None) -> int:
    """Merge the latest weekly window, retaining older valid observations."""
    as_of = today or date.today()
    existing = _load_existing()
    print("Syncing Fitness Age history…")
    try:
        payload = retry_transient(
            lambda: client.get_fitness_age_weekly(as_of.isoformat(), _WEEKS)
        )
    except (GarminAPIError, httpx.HTTPError):
        print("  Fitness Age history unavailable; keeping existing normalized data.")
        return len(existing)

    fetched = normalize_weekly_fitness_age(payload)
    if not fetched:
        print("  No weekly Fitness Age samples returned; keeping existing normalized data.")
        return len(existing)

    merged = {**existing, **fetched}
    _PATH.parent.mkdir(parents=True, exist_ok=True)
    _PATH.write_text(json.dumps({"weeks": dict(sorted(merged.items()))}, indent=2) + "\n")
    print(f"  {len(fetched)} weekly sample(s) refreshed, {len(merged)} total.")
    return len(merged)
