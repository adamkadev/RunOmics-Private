#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from garmin.client import GarminAPIError, GarminAuthError, GarminClient
from garmin.retry import retry_transient
from processing.mapper import extract_gear_id
from repository.json_store import JsonActivityStore

_RATE_LIMIT_PAUSE = 1.0


def main() -> int:
    args = _parse_args()

    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not secret:
        print("Error: GARMIN_SECRET environment variable is not set.", file=sys.stderr)
        print("Run scripts/get_secret.py to generate it.", file=sys.stderr)
        return 1

    store = JsonActivityStore()
    pending = [a for a in store.all_activities() if "gearId" not in a]

    if args.limit:
        pending = pending[: args.limit]

    if not pending:
        print("Nothing to backfill: all activities already have gearId.")
        return 0

    print(f"Backfilling gear for {len(pending)} activit{'y' if len(pending) == 1 else 'ies'}…")

    try:
        with GarminClient(secret) as client:
            updated = 0
            for i, activity in enumerate(pending, 1):
                activity_id = activity["id"]
                print(f"  [{i}/{len(pending)}] Activity {activity_id} …", end=" ", flush=True)

                try:
                    raw_gear = retry_transient(lambda: client.get_activity_gear(activity_id))
                except GarminAPIError as exc:
                    print(f"failed ({exc})")
                    continue

                if args.debug:
                    print(f"\n    raw gear response: {json.dumps(raw_gear)}")

                gear_id = extract_gear_id(raw_gear)
                activity["gearId"] = gear_id
                store.touch(activity_id)
                print(f"gearId = {gear_id}")
                updated += 1

                time.sleep(_RATE_LIMIT_PAUSE)
    except GarminAuthError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if not args.dry_run:
        store.save()
        print(f"\n{updated} activities updated and saved.")
    else:
        print(f"\nDry run: {updated} would be updated (not saved).")

    print("\nTo (re)generate SHOE_REGISTRY in src/domain/shoe/types.ts, run scripts/sync_shoes.py.")

    return 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill gearId on existing activities.json entries from Garmin Connect"
    )
    parser.add_argument("--limit", type=int, default=None, metavar="N")
    parser.add_argument("--debug", action="store_true", help="print raw gear API response per activity")
    parser.add_argument("--dry-run", action="store_true", help="don't write activities.json")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
