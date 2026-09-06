#!/usr/bin/env python3
"""Verify no activity's route still has a start/finish inside a privacy zone.

Reuses processing/privacy.py's crop_privacy_zone directly - re-cropping
already-clean data is a no-op, so any change here means an endpoint is still
exposed. Never duplicates the real zone coordinates: needs PRIVACY_ZONES /
PRIVACY_RADIUS_M set in the environment, same as sync.py and reprocess.py.

Garmin-confirmed races store their full course on purpose, so they are exempt
rather than failures. They are reported as a count: an exemption nobody can see
is one nobody re-checks.

    python scripts/verify_privacy_zone.py
    python scripts/verify_privacy_zone.py --base-url https://your-domain
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from data_directory import get_data_dir
from processing.privacy import crop_privacy_zone, is_confirmed_race

_LOCAL_DIR = get_data_dir() / "activities"


def _months_and_loader(base_url: str | None):
    if base_url:
        def load(month: str) -> dict:
            with urllib.request.urlopen(f"{base_url.rstrip('/')}/data/activities/{month}.json") as resp:
                return json.loads(resp.read())

        with urllib.request.urlopen(f"{base_url.rstrip('/')}/data/activities/index.json") as resp:
            months = json.loads(resp.read())["months"]
    else:
        def load(month: str) -> dict:
            return json.loads((_LOCAL_DIR / f"{month}.json").read_text())

        months = json.loads((_LOCAL_DIR / "index.json").read_text())["months"]

    return months, load


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", help="check a live deployment instead of local files, e.g. https://your-domain")
    args = parser.parse_args()

    months, load = _months_and_loader(args.base_url)

    checked = 0
    races = 0
    exposed: list[tuple[str, str]] = []
    for month in months:
        for activity in load(month)["activities"]:
            route = activity.get("route")
            if not route:
                continue
            # Exempt by policy, not an oversight - counted and reported rather
            # than skipped silently, so the exemption stays visible in an audit.
            if is_confirmed_race(activity):
                races += 1
                continue
            checked += 1
            if crop_privacy_zone(route) != route:
                exposed.append((month, activity["id"]))

    if races:
        print(f"{races} Garmin-confirmed race route(s) exempt from cropping by policy (public race courses).")

    if exposed:
        print(f"STILL EXPOSED: {len(exposed)} of {checked} activities have an endpoint inside a privacy zone:")
        for month, activity_id in exposed:
            print(f"  {month}: {activity_id}")
        return 1

    print(f"OK - 0 of {checked} activities have an endpoint inside a privacy zone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
