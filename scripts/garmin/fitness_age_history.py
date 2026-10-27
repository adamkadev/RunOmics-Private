from __future__ import annotations

from datetime import date
from typing import Any

import httpx

from data_directory import get_data_dir
from .client import GarminAPIError, GarminClient
from .retry import retry_transient
from .step_warnings import warn
from repository.history_file import read_history_section, write_history

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

        # The payload's RHR derivative is left out on purpose: canonical RHR comes from the HR-zone config.
        if sample:
            weeks[normalized_date] = sample

    return dict(sorted(weeks.items()))


def _load_existing() -> dict[str, dict[str, Any]]:
    return read_history_section(_PATH, "weeks")


def sync_fitness_age_history(client: GarminClient, today: date | None = None) -> int:
    as_of = today or date.today()
    existing = _load_existing()
    print("Syncing Fitness Age history…")
    try:
        payload = retry_transient(
            lambda: client.get_fitness_age_weekly(as_of.isoformat(), _WEEKS)
        )
    except (GarminAPIError, httpx.HTTPError) as exc:
        warn("fitness age history", f"Fitness Age history unavailable ({type(exc).__name__}); keeping existing data.")
        return len(existing)

    fetched = normalize_weekly_fitness_age(payload)
    if not fetched:
        print("  No weekly Fitness Age samples returned; keeping existing normalized data.")
        return len(existing)

    merged = {**existing, **fetched}
    write_history(_PATH, {"weeks": dict(sorted(merged.items()))})
    print(f"  {len(fetched)} weekly sample(s) refreshed, {len(merged)} total.")
    return len(merged)
