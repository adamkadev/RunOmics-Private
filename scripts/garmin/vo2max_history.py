"""Garmin's own front-end never asks for more than twelve months at a time, so a longer history is fetched in windows."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from data_directory import get_data_dir
from .client import GarminAPIError, GarminClient
from .retry import retry_transient
from repository.history_file import read_history, write_history

_OUT_PATH = get_data_dir() / "vo2max_history.json"

_WINDOW_MONTHS = 12
# Only the four-week view plots daily samples, so nothing older is worth a request.
_DAILY_WINDOW_DAYS = 35


def _first_of_month(day: date, offset: int = 0) -> date:
    total = day.month - 1 + offset
    return date(day.year + total // 12, total % 12 + 1, 1)


def _end_of_month(day: date) -> date:
    return _first_of_month(day, 1) - timedelta(days=1)


def monthly_windows(start: date, today: date) -> list[tuple[date, date]]:
    windows: list[tuple[date, date]] = []
    last = _end_of_month(today)
    cursor = _first_of_month(start)

    while cursor <= last:
        window_end = min(_end_of_month(_first_of_month(cursor, _WINDOW_MONTHS - 1)), last)
        windows.append((cursor, window_end))
        cursor = _first_of_month(window_end, 1)

    return windows


def normalize_max_met(entries: Any) -> dict[str, dict[str, Any]]:
    """Keyed by month so a re-fetch is idempotent: Garmin dates the running month on its latest day, which moves."""
    samples: dict[str, dict[str, Any]] = {}

    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        generic = entry.get("generic") or {}

        day = generic.get("calendarDate")
        vo2max = generic.get("vo2MaxPreciseValue") or generic.get("vo2MaxValue")
        if not day or not vo2max:
            continue

        sample: dict[str, Any] = {"date": day, "vo2max": round(vo2max, 1)}

        fitness_age = generic.get("fitnessAge")
        if fitness_age:
            sample["fitnessAge"] = round(fitness_age, 1)

        samples[day[:7]] = sample

    return samples


def _load_stored() -> dict[str, Any]:
    return read_history(_OUT_PATH)


def _fetch_months(client: GarminClient, start: date, today: date) -> dict[str, dict[str, Any]]:
    months: dict[str, dict[str, Any]] = {}

    for window_start, window_end in monthly_windows(start, today):
        try:
            payload = retry_transient(
                client.get_max_met_monthly, window_start.isoformat(), window_end.isoformat()
            )
        except GarminAPIError as exc:
            print(f"  Warning: VO2max {window_start:%Y-%m}…{window_end:%Y-%m} failed: {exc}")
            continue
        months.update(normalize_max_met(payload))

    return months


def _fetch_days(client: GarminClient, today: date) -> dict[str, dict[str, Any]]:
    start = today - timedelta(days=_DAILY_WINDOW_DAYS)
    try:
        payload = retry_transient(
            lambda: client.get_max_met_daily(start.isoformat(), today.isoformat())
        )
    except GarminAPIError as exc:
        print(f"  Warning: daily VO2max fetch failed: {exc}")
        return {}

    return {sample["date"]: sample for sample in normalize_max_met(payload).values()}


def sync_vo2max_history(client: GarminClient, start: date, today: date | None = None) -> int:
    """Merged over what is stored, so what Garmin ages out of its retention window stays in ours."""
    today = today or date.today()
    print("Syncing VO2max history…")

    stored = _load_stored()
    months = {**(stored.get("months") or {}), **_fetch_months(client, start, today)}
    days = {**(stored.get("days") or {}), **_fetch_days(client, today)}

    if not months:
        print("  No VO2max samples returned.")
        return 0

    write_history(_OUT_PATH, {"months": dict(sorted(months.items())), "days": dict(sorted(days.items()))})

    latest = months[max(months)]
    print(
        f"  {len(months)} month(s) and {len(days)} day(s) stored, "
        f"latest {latest['vo2max']} ml/kg/min."
    )
    return len(months)
