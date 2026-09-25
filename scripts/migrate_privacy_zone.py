#!/usr/bin/env python3
"""Re-crop every already-synced activity's route to the current privacy zone
(processing/privacy.py). sync.py and reprocess.py only crop what they write,
so this is what brings routes stored under an older rule - or an older
PRIVACY_* configuration - up to the current one, whether or not a cached FIT
file still exists for them.

Cropping is deterministic per activity and removes nothing from a route that
is already cropped, so this is safe to run on every sync: the first run
rewrites what needs it, every later one reports zero changes. The nightly
workflow runs it before verify_privacy_zone.py and before anything is pushed.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from processing.privacy import crop_privacy_zone
from repository.json_store import JsonActivityStore


def main() -> int:
    store = JsonActivityStore()

    changed = 0
    points_removed = 0
    for a in store.all_activities():
        before = a.get("route")
        if not before:
            continue
        after = crop_privacy_zone(before, a["id"])
        if after != before:
            points_removed += len(before) - (len(after) if after else 0)
            a["route"] = after
            store.touch(a["id"])
            changed += 1

    if changed:
        store.save()
    print(f"{changed} activities re-cropped, {points_removed} GPS points removed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
