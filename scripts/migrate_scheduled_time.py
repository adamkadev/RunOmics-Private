#!/usr/bin/env python3
"""One-time migration: bucket every already-synced planned workout's
scheduledTime to a coarse time-of-day label (sync_workouts.py._bucket_scheduled_time).

Needed because sync_workouts.py only buckets going forward - this rewrites
entries already committed to public/data/planned_workouts/*.json, including
ones outside the sync window that a regular run would never touch again.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from repository.json_store import PlannedWorkoutStore
from sync_workouts import _bucket_scheduled_time, _DEFAULT_SCHEDULED_TIME


def main() -> int:
    store = PlannedWorkoutStore()

    changed = 0
    for entry in store.all_entries():
        before = entry.get("scheduledTime", _DEFAULT_SCHEDULED_TIME)
        after = _bucket_scheduled_time(before)
        if after != before:
            entry["scheduledTime"] = after
            store.upsert(entry)
            changed += 1

    store.save()
    print(f"{changed} planned workout(s) had their scheduledTime coarsened.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
