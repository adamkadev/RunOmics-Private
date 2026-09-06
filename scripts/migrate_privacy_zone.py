#!/usr/bin/env python3
"""One-time (re-runnable) migration: crop every already-synced activity's route
to the current privacy zone (processing/privacy.py). Needed because sync.py
and reprocess.py only apply the crop going forward - this rewrites the routes
already stored in the selected data workspace, independent of whether a
cached FIT file exists for them.

Re-run this after changing PRIVACY_ZONES or PRIVACY_RADIUS_M in
processing/privacy.py to re-crop with the new settings.

Garmin-confirmed races are skipped: their full course is stored deliberately
(processing/privacy.py > route_for_storage), so cropping them here would undo
that on the next migration run.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from processing.privacy import crop_privacy_zone, is_confirmed_race
from repository.json_store import JsonActivityStore


def main() -> int:
    store = JsonActivityStore()

    changed = 0
    points_removed = 0
    races_preserved = 0
    for a in store.all_activities():
        before = a.get("route")
        if not before:
            continue
        # A race course is public event information and is stored whole on
        # purpose; re-cropping here would silently undo that exemption.
        if is_confirmed_race(a):
            races_preserved += 1
            continue
        after = crop_privacy_zone(before)
        if after != before:
            points_removed += len(before) - (len(after) if after else 0)
            a["route"] = after
            store.touch(a["id"])
            changed += 1

    store.save()
    print(f"{changed} activities re-cropped, {points_removed} GPS points removed from route start/finish.")
    print(f"{races_preserved} Garmin-confirmed races left whole (public race courses).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
