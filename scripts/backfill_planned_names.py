#!/usr/bin/env python3
"""One-off: apply prefer_planned_name() to every already-synced activity.

Run once after backfill_planned_workout_history.py has seeded the durable
planned-workout store, and after any change to how planned names are built.
Only activities whose date has a matching planned entry - and whose own
description that entry describes better - get updated (see
sync_workouts.prefer_planned_name). Most of the synced activities predate the
planned-workout feature entirely and won't match anything: that's expected,
not a bug.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from repository.json_store import JsonActivityStore, PlannedWorkoutStore
from sync_workouts import prefer_planned_name


def main() -> int:
    args = _parse_args()

    activity_store = JsonActivityStore()
    planned_store = PlannedWorkoutStore()

    activities = activity_store.all_activities()
    if args.limit:
        activities = activities[: args.limit]

    updated = 0
    for activity in activities:
        plan = planned_store.get(activity.get("date", ""))
        if not plan:
            continue
        better = prefer_planned_name(activity.get("description", ""), plan)
        if not better:
            continue

        print(f"  {activity['date']}  {activity['id']}  {activity['description']!r} -> {better!r}")
        activity["description"] = better
        activity_store.touch(activity["id"])
        updated += 1

    if updated == 0:
        print("Nothing to backfill: no activity descriptions matched a richer planned name.")
        return 0

    print(f"\n{updated} activit{'y' if updated == 1 else 'ies'} would be updated.")

    if args.dry_run:
        print("Dry run: not saved.")
    else:
        activity_store.save()
        print("Saved to public/data/activities/.")

    return 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill activity descriptions from the durable planned-workout store"
    )
    parser.add_argument("--limit", type=int, default=None, metavar="N")
    parser.add_argument("--dry-run", action="store_true", help="don't write activities.json")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
