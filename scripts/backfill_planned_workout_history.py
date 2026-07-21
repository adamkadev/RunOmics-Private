#!/usr/bin/env python3
"""One-off: seed the new per-year planned-workout store from git history.

public/data/planned_workouts.json used to be a rolling window (today-7 days to
today+90 days), fully overwritten every sync - so before this repo switched to
PlannedWorkoutStore, any date older than ~a week was silently dropped from the
working tree on the next sync. Every synced version was still committed to git,
though, so this walks that history (oldest-first) and upserts every entry ever
seen into the new durable store, later commits' versions winning per date.

This only recovers whatever the file's git history covers (the feature was
added partway through this repo's life) - it is not a substitute for the store
now retaining everything going forward.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from repository.json_store import PlannedWorkoutStore

_REPO_ROOT = Path(__file__).parent.parent
_TRACKED_PATH = "public/data/planned_workouts.json"


def _commit_shas() -> list[str]:
    result = subprocess.run(
        ["git", "log", "--follow", "--format=%H", "--reverse", "--", _TRACKED_PATH],
        cwd=_REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def _entries_at(sha: str) -> list[dict]:
    result = subprocess.run(
        ["git", "show", f"{sha}:{_TRACKED_PATH}"],
        cwd=_REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return []
    try:
        return json.loads(result.stdout).get("planned", [])
    except json.JSONDecodeError:
        return []


def main() -> int:
    args = _parse_args()

    shas = _commit_shas()
    if not shas:
        print(f"No commit history found for {_TRACKED_PATH}.")
        return 0

    print(f"Walking {len(shas)} commit(s) touching {_TRACKED_PATH} (oldest first)…")

    store = PlannedWorkoutStore()
    seen_dates: set[str] = set()
    for sha in shas:
        for entry in _entries_at(sha):
            store.upsert(entry)
            seen_dates.add(entry["date"])

    if not seen_dates:
        print("No planned-workout entries recovered.")
        return 0

    print(f"Recovered {len(seen_dates)} distinct date(s): {min(seen_dates)} -> {max(seen_dates)}")
    print(f"Store now has {store.count()} total planned workout(s).")

    if args.dry_run:
        print("Dry run: not saved.")
    else:
        store.save()
        print("Saved to public/data/planned_workouts/.")

    return 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed the per-year planned-workout store from planned_workouts.json's git history"
    )
    parser.add_argument("--dry-run", action="store_true", help="don't write the store")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
