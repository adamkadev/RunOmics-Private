#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from processing.fit_parser import parse_fit
from processing.weather import WeatherClient, weather_for_activity
from repository.json_store import JsonActivityStore

_FIT_DIR = Path(__file__).parent.parent / "public" / "fit"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fill in the weather conditions of activities that have none yet"
    )
    parser.add_argument("--limit", type=int, default=None, metavar="N", help="stop after N lookups")
    parser.add_argument("--force", action="store_true", help="re-request activities that already have weather")
    parser.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    args = parser.parse_args()

    store = JsonActivityStore()
    client = WeatherClient()
    outcomes: Counter[str] = Counter()
    filled_ids: set[str] = set()
    attempted = 0

    activities = sorted(store.all_activities(), key=lambda a: a.get("date", ""))
    print(f"{len(activities)} activities on file")

    for activity in activities:
        if activity.get("weather") is not None and not args.force:
            outcomes["already had weather"] += 1
            continue

        # Read off the JSON rather than the FIT: a run with no GPS trace has no
        # start point to look conditions up at, and that costs no request to know.
        if not activity.get("route"):
            outcomes["no GPS trace"] += 1
            continue

        if args.limit is not None and attempted >= args.limit:
            outcomes["not attempted (limit)"] += 1
            continue

        fit_path = _FIT_DIR / f"{activity['id']}.fit"
        if not fit_path.exists():
            outcomes["FIT file not cached"] += 1
            continue

        parsed = parse_fit(fit_path.read_bytes())
        if parsed.start_time_local is None:
            outcomes["no local start time in FIT"] += 1
            continue

        attempted += 1
        weather = weather_for_activity(client, parsed)
        if weather is None:
            outcomes["no data from Open-Meteo"] += 1
            print(f"  {activity['date']} {activity['id']}: no data")
            continue

        outcomes["filled"] += 1
        filled_ids.add(activity["id"])
        print(
            f"  {activity['date']} {activity['id']}: {weather['tempC']}°C"
            f" (feels {weather['apparentTempC']}°C), {weather['humidityPct']}% RH,"
            f" {weather['windKph']} km/h, {weather['precipitationMm']} mm"
        )

        if not args.dry_run:
            activity["weather"] = weather
            store.touch(activity["id"])

    if not args.dry_run:
        for activity in activities:
            if "weather" not in activity:
                activity["weather"] = None
                store.touch(activity["id"])
        store.save()

    # Union rather than a plain count so the tally reads the same on a dry run,
    # where the filled activities are deliberately not on disk.
    covered = {a["id"] for a in store.all_activities() if a.get("weather")} | filled_ids
    print(f"\n{client.requests} API request(s), {client.failures} failed")
    for reason, count in outcomes.most_common():
        print(f"  {count:>4}  {reason}")
    verb = "would have" if args.dry_run else "have"
    print(f"\n{len(covered)}/{len(activities)} activities {verb} weather.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
