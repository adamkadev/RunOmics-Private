"""Sync Garmin's own VO2max series to the private data workspace.

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

Without a Connect session - no GARMIN_SECRET, a garth token past saving, or a
quick sync - sync_vo2max_from_runs carries both series on from the runs themselves: each
FIT file's own VO2max reading (message 140), within 0.1 of Connect's daily
value (Lamiaa, Oct 2026: 37.1/37.1, 37.1/37.2, 37.4/37.4, 37.3/37.4).
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta
from typing import Any

from data_directory import get_data_dir
from .client import GarminAPIError, GarminClient
from .retry import retry_transient
from .step_warnings import warn
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
            warn("VO2max history", f"VO2max {window_start:%Y-%m}…{window_end:%Y-%m} failed: {exc}")
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
        warn("VO2max history", f"daily VO2max fetch failed: {exc}")
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

    # Connect's series replaces whatever was carried on from the runs while
    # it was away.
    stored = {
        name: {key: sample for key, sample in (series or {}).items() if sample.get("source") != _CARRIED}
        for name, series in _load_stored().items()
    }
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


# Marks a sample carried on from a run's FIT file, so Connect's own samples
# can be told apart: they set where carrying starts, and replace every carried
# one the next time Connect answers.
_CARRIED = "fit"


def _is_run(activity: dict[str, Any]) -> bool:
    """Running of any kind (trail, track, treadmill); a record from before the
    sport was stored came from the running-only sync."""
    sport = activity.get("sport")
    return sport is None or "running" in str(sport)


def _run_order(activity: dict[str, Any]) -> tuple[str, int]:
    # Stored dates carry no time; Garmin's ids grow, so the later of two runs
    # on a day has the larger one.
    activity_id = str(activity.get("id") or "")
    return str(activity.get("date") or "")[:10], int(activity_id) if activity_id.isdigit() else 0


def samples_from_runs(activities: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Each day's last FIT VO2max reading among the runs, keyed by date."""
    days: dict[str, dict[str, Any]] = {}
    for activity in sorted((a for a in activities if _is_run(a)), key=_run_order):
        day = _run_order(activity)[0]
        value = activity.get("vo2maxGarmin")
        if day and isinstance(value, (int, float)) and value > 0:
            days[day] = {"date": day, "vo2max": round(value, 1), "source": _CARRIED}
    return days


def sync_vo2max_from_runs(activities: Iterable[dict[str, Any]], today: date | None = None) -> int:
    """Carry the stored series on from the runs' readings; returns the month count.

    Connect's series stands up to its last own sample: on the days before it,
    Connect was answering, and a run it left unsampled had not moved VO2max.
    Every run after it is carried - its day, and its month (keeping the
    month's fitness age, which only Connect knows).
    """
    today = today or date.today()
    stored = _load_stored()
    months: dict[str, Any] = dict(stored.get("months") or {})
    days: dict[str, Any] = dict(stored.get("days") or {})
    connects = [s for s in (*months.values(), *days.values()) if isinstance(s, dict) and s.get("source") != _CARRIED]
    last_connect = max((str(s.get("date") or "") for s in connects), default="")
    since = (today - timedelta(days=_DAILY_WINDOW_DAYS)).isoformat()

    carried = 0
    for day, sample in samples_from_runs(activities).items():
        if day <= last_connect:
            continue
        month = months.get(day[:7]) or {}
        months[day[:7]] = {**sample, **({"fitnessAge": month["fitnessAge"]} if "fitnessAge" in month else {})}
        if day >= since:
            days[day] = sample
        carried += 1

    if carried:
        write_history(_OUT_PATH, {"months": dict(sorted(months.items())), "days": dict(sorted(days.items()))})
    print(f"VO2max carried on from {carried} run day(s) after Connect's last sample.")
    return len(months)


def newest_carried_vo2max() -> float | None:
    """The newest VO2max in the stored series when a run's FIT reading holds
    it - None when Connect's own sample is the newest, which stays as it is."""
    stored = _load_stored()
    samples = [s for s in (*(stored.get("months") or {}).values(), *(stored.get("days") or {}).values()) if isinstance(s, dict)]
    if not samples:
        return None
    newest = max(samples, key=lambda s: (str(s.get("date") or ""), s.get("source") != _CARRIED))
    return newest.get("vo2max") if newest.get("source") == _CARRIED else None
