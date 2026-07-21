"""Sync Garmin's own VO2max series to public/data/vo2max_history.json.

  metrics-service/metrics/maxmet/monthly/{start}/{end}
  metrics-service/metrics/maxmet/daily/{start}/{end}

This is the series Garmin Connect plots itself, and it carries two things the
per-activity readings on activities.json do not: `vo2MaxPreciseValue`, which
keeps a decimal where the activity payload only exposes the rounded integer,
and a fitness age per month. A rounded series turns a slow physiological drift
into a staircase of whole points, so this is the source worth charting.

Garmin's own front-end never asks for more than twelve months at a time, so a
longer history is fetched as consecutive twelve-month windows. Samples are
merged into the stored file rather than replacing it: whatever Garmin stops
serving once it ages out of its retention window stays in ours.

The monthly series feeds the six-month and one-year views; the daily one, kept
to a recent window, feeds the four-week view. The daily endpoint is
undocumented, so a failure there is a warning, not a failed sync.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from .client import GarminAPIError, GarminClient
from .retry import retry_transient

_OUT_PATH = Path(__file__).parent.parent.parent / "public" / "data" / "vo2max_history.json"

_WINDOW_MONTHS = 12
# Only the four-week view plots daily samples, so nothing older is worth a request.
_DAILY_WINDOW_DAYS = 35


def _first_of_month(day: date, offset: int = 0) -> date:
    total = day.month - 1 + offset
    return date(day.year + total // 12, total % 12 + 1, 1)


def _end_of_month(day: date) -> date:
    return _first_of_month(day, 1) - timedelta(days=1)


def monthly_windows(start: date, today: date) -> list[tuple[date, date]]:
    """The whole span split into month-aligned windows of at most a year."""
    windows: list[tuple[date, date]] = []
    last = _end_of_month(today)
    cursor = _first_of_month(start)

    while cursor <= last:
        window_end = min(_end_of_month(_first_of_month(cursor, _WINDOW_MONTHS - 1)), last)
        windows.append((cursor, window_end))
        cursor = _first_of_month(window_end, 1)

    return windows


def normalize_max_met(entries: Any) -> dict[str, dict[str, Any]]:
    """Garmin's monthly records keyed by `YYYY-MM`.

    Keying by month rather than by the sample's own date makes a re-fetch
    idempotent: the running month is sampled on the last day Garmin has data
    for, so its date moves as the month fills in.
    """
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


def _load_stored() -> dict[str, dict[str, Any]]:
    if not _OUT_PATH.exists():
        return {}
    try:
        return json.loads(_OUT_PATH.read_text())
    except Exception:
        return {}


def _fetch_months(client: GarminClient, start: date, today: date) -> dict[str, dict[str, Any]]:
    months: dict[str, dict[str, Any]] = {}

    for window_start, window_end in monthly_windows(start, today):
        try:
            payload = retry_transient(
                lambda: client.get_max_met_monthly(
                    window_start.isoformat(), window_end.isoformat()
                )
            )
        except GarminAPIError as exc:
            print(f"  Warning: VO2max {window_start:%Y-%m}…{window_end:%Y-%m} failed: {exc}")
            continue
        months.update(normalize_max_met(payload))

    return months


def _fetch_days(client: GarminClient, today: date) -> dict[str, dict[str, Any]]:
    """The recent daily samples, which only the four-week view plots."""
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
    """Merge the monthly and recent daily series into vo2max_history.json.

    Returns the month count. Both series are re-fetched whole on every run -
    that is three requests or so - and merged over what is stored, so nothing
    Garmin has aged out is lost.
    """
    today = today or date.today()
    print("Syncing VO2max history…")

    stored = _load_stored()
    months = {**(stored.get("months") or {}), **_fetch_months(client, start, today)}
    days = {**(stored.get("days") or {}), **_fetch_days(client, today)}

    if not months:
        print("  No VO2max samples returned.")
        return 0

    _OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    _OUT_PATH.write_text(
        json.dumps(
            {"months": dict(sorted(months.items())), "days": dict(sorted(days.items()))},
            indent=2,
        )
        + "\n"
    )

    latest = months[max(months)]
    print(
        f"  {len(months)} month(s) and {len(days)} day(s) stored, "
        f"latest {latest['vo2max']} ml/kg/min."
    )
    return len(months)
