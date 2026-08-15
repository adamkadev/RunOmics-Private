#!/usr/bin/env python3
"""Sync shoe gear from Garmin Connect into public/data/shoes.json.

Run this whenever a shoe is added or retired in Garmin Connect. Unlike
sync.py it is not run on a schedule, since shoes only change a few times a
year.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from garmin.client import GarminAuthError, GarminClient
from garmin.gear import fetch_shoe_gear, write_shoes_json


def main() -> int:
    args = _parse_args()

    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not secret:
        print("Error: GARMIN_SECRET environment variable is not set.", file=sys.stderr)
        print("Run scripts/get_secret.py to generate it.", file=sys.stderr)
        return 1

    try:
        with GarminClient(secret) as client:
            shoes = fetch_shoe_gear(client)
    except GarminAuthError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if not shoes:
        print("No shoe gear found on Garmin Connect.")
        return 0

    print(f"Found {len(shoes)} shoe(s):")
    for shoe in shoes:
        status = "retired" if shoe.retired else "active"
        print(f"  {shoe.brand} {shoe.name}  ({status}, max {shoe.max_km} km)  {shoe.gear_id}")

    if args.dry_run:
        print("\nDry run - preview of shoes.json:\n")
        print(json.dumps({"shoes": [shoe.to_dict() for shoe in shoes]}, indent=2))
        return 0

    if write_shoes_json(shoes):
        print("\npublic/data/shoes.json updated - review it, then push it with scripts/push_private_data.mjs.")
    else:
        print("\npublic/data/shoes.json already up to date.")

    return 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync shoe gear from Garmin Connect into SHOE_REGISTRY"
    )
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
