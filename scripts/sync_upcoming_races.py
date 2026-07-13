#!/usr/bin/env python3
"""Sync upcoming races from Garmin Connect to public/data/upcoming_races.json.

Garmin Connect calendar events marked as a race (isRace: true) carry a name,
date, distance and optional location - but no goal time, so `targetSeconds`
is left to be set manually and is preserved across syncs (matched by Garmin's
stable `shareableEventUuid`), same as planned_workouts.json preserves manually
edited fields.

Can be run standalone or imported by sync.py.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from garmin.client import GarminAPIError, GarminAuthError, GarminClient

_DATA_DIR = Path(__file__).parent.parent / "public" / "data"
_RATE_LIMIT_PAUSE = 1.0
_RETRY_PAUSE = 60.0
_WINDOW_PAST_DAYS = 400
_WINDOW_FUTURE_DAYS = 400

_UNIT_TO_KM = {"kilometer": 1.0, "meter": 0.001, "mile": 1.60934}
_STANDARD_DISTANCES_KM = [
    (1.0, "1K"),
    (5.0, "5K"),
    (10.0, "10K"),
    (21.0975, "Half-Marathon"),
    (42.195, "Marathon"),
]
_STANDARD_DISTANCE_TOLERANCE = 0.03


def main() -> int:
    args = _parse_args()

    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not secret:
        print("Error: GARMIN_SECRET environment variable is not set.", file=sys.stderr)
        print("Run scripts/get_secret.py to generate it.", file=sys.stderr)
        return 1

    try:
        with GarminClient(secret) as client:
            races = fetch_upcoming_races(client)
    except GarminAuthError as exc:
        print(f"Auth error: {exc}", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"Dry run: {len(races)} race(s) found")
        for r in races:
            extra = " · ".join(filter(None, [r.get("location"), r["distance"]]))
            print(f"  {r['date']}  {r['name']}" + (f"  ({extra})" if extra else ""))
        return 0

    write_upcoming_races(races)
    return 0


def write_upcoming_races(races: list[dict]) -> None:
    out_path = _DATA_DIR / "upcoming_races.json"

    existing: dict[str, dict] = {}
    if out_path.exists():
        try:
            raw = json.loads(out_path.read_text())
            for entry in raw.get("races", []):
                key = entry.get("garminEventUuid")
                if key:
                    existing[key] = entry
        except Exception:
            pass

    for entry in races:
        prior = existing.get(entry["garminEventUuid"])
        if prior and prior.get("targetSeconds") is not None:
            entry["targetSeconds"] = prior["targetSeconds"]

    races.sort(key=lambda r: r["date"])
    out_path.write_text(json.dumps({"races": races}, ensure_ascii=False, indent=2))
    print(f"  {len(races)} race(s) written to upcoming_races.json")


def fetch_upcoming_races(client: GarminClient) -> list[dict]:
    """Return a list of race entries for the rolling window."""
    today = date.today()
    start_date = today - timedelta(days=_WINDOW_PAST_DAYS)
    end_date = today + timedelta(days=_WINDOW_FUTURE_DAYS)

    print(f"Syncing upcoming races {start_date} -> {end_date}…")

    months: list[tuple[int, int]] = []
    cur = start_date.replace(day=1)
    while cur <= end_date:
        months.append((cur.year, cur.month))
        cur = (cur + timedelta(days=32)).replace(day=1)

    seen: set[str] = set()
    races: list[dict] = []
    for year, month in months:
        try:
            data = _retry_on_429(lambda y=year, m=month: client.get_calendar_month(y, m))
        except GarminAPIError as exc:
            print(f"  Warning: calendar {year}-{month:02d} failed: {exc}")
            continue

        for item in data.get("calendarItems", []):
            if not item.get("isRace"):
                continue
            item_date = item.get("date", "")
            if not item_date:
                continue
            if item_date < start_date.isoformat() or item_date > end_date.isoformat():
                continue
            uuid = item.get("shareableEventUuid")
            if not uuid or uuid in seen:
                continue
            seen.add(uuid)
            races.append(_map_race(item))

        time.sleep(_RATE_LIMIT_PAUSE)

    print(f"  Found {len(races)} race(s).")
    return races


def _map_race(item: dict) -> dict:
    distance = _format_distance(item.get("completionTarget"))
    entry: dict = {
        "garminEventUuid": item["shareableEventUuid"],
        "date": item["date"],
        "name": _strip_distance_suffix((item.get("title") or "").strip(), distance),
        "distance": distance,
    }
    if item.get("location"):
        entry["location"] = _simplify_location(item["location"])
    return entry


def _strip_distance_suffix(name: str, distance: str) -> str:
    """Drop a trailing "(distance)" suffix that just duplicates the `distance` field."""
    if not distance:
        return name
    match = re.search(r"\s*\(([^()]*)\)\s*$", name)
    if not match:
        return name
    normalized_suffix = match.group(1).replace("-", " ").strip().lower()
    normalized_distance = distance.replace("-", " ").strip().lower()
    if normalized_suffix != normalized_distance:
        return name
    return name[: match.start()].rstrip()


def _simplify_location(location: str) -> str:
    """Keep just the city, dropping the ", country/region" suffix Garmin appends."""
    return location.split(",")[0].strip()


def _format_distance(completion_target: dict | None) -> str:
    if not completion_target:
        return ""

    unit = completion_target.get("unit", "")
    km = (completion_target.get("value") or 0) * _UNIT_TO_KM.get(unit, 0)
    if km <= 0:
        return ""

    for std_km, label in _STANDARD_DISTANCES_KM:
        if abs(km - std_km) / std_km <= _STANDARD_DISTANCE_TOLERANCE:
            return label

    return f"{km:g} km"


def _retry_on_429(fn):
    try:
        return fn()
    except GarminAPIError as exc:
        if exc.status_code != 429:
            raise
        print(f"  Rate limited, waiting {_RETRY_PAUSE}s…", flush=True)
        time.sleep(_RETRY_PAUSE)
        return fn()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Garmin upcoming races into RunOmics")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
