#!/usr/bin/env python3
"""One-off: rebuild Garmin Coach workout names in the planned-workout store.

Coach entries were stored under the session type alone ("Base", "Seuil") or
that type plus a raw Garmin descriptor ("Anaérobique - 7x1:00@3:45/km"), both
of which repeat the type badge the UI already shows. This rewrites them to the
session's structure alone ("3x8'@4:20"), the same shape sync_workouts.py now
produces - from each entry's stored `steps`, so no Garmin call is needed.

Entries whose structure says nothing beyond the duration already stored (an
easy run with no target pace) keep their name. Third-party plan names are
never touched.

Run scripts/backfill_planned_names.py afterwards to propagate the new names
onto the matching activities.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from processing.garmin_workout import (
    has_rep_structure,
    normalize_descriptor,
    steps_descriptor,
)
from processing.planned_workout_type import coach_type_word
from repository.json_store import PlannedWorkoutStore


def rebuilt_name(entry: dict) -> str | None:
    """The structure-only name for a Garmin Coach entry, or None to keep the
    stored one. Mirrors main_set_descriptor's precedence: a rep structure a
    previous sync folded into the name came from Garmin's own description and
    is authoritative; anything else is rebuilt from the stored steps."""
    name = entry.get("name", "")
    if not coach_type_word(name):
        return None

    _, _, folded = name.partition(" - ")
    descriptor = (
        normalize_descriptor(folded)
        if has_rep_structure(folded)
        else steps_descriptor(entry.get("steps") or [])
    )
    return descriptor if descriptor and descriptor != name else None


def main() -> int:
    args = _parse_args()
    store = PlannedWorkoutStore()

    renamed = 0
    for entry in store.all_entries():
        new_name = rebuilt_name(entry)
        if not new_name:
            continue
        print(f"  {entry['date']}  {entry['name']!r} -> {new_name!r}")
        entry["name"] = new_name
        store.upsert(entry)
        renamed += 1

    if renamed == 0:
        print("Nothing to backfill: no Garmin Coach entry needed a new name.")
        return 0

    print(f"\n{renamed} planned workout(s) would be renamed.")

    if args.dry_run:
        print("Dry run: not saved.")
    else:
        store.save()
        print("Saved to public/data/planned_workouts/.")

    return 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rebuild Garmin Coach planned-workout names from their stored steps"
    )
    parser.add_argument("--dry-run", action="store_true", help="don't write the store")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
