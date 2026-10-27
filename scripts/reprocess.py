#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from data_directory import get_data_dir, get_fit_cache_dir
from processing.fit_parser import parse_fit
from processing.activity_type import infer_type_with_source
from processing.mapper import stored_fit_fields
from processing.type_context import load_type_context
from repository.json_store import JsonActivityStore

_FIT_DIR = get_fit_cache_dir()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Re-run the FIT parser on all cached FIT files and rewrite activities JSON"
    )
    parser.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    args = parser.parse_args()

    store = JsonActivityStore()
    type_context = load_type_context(get_data_dir())

    updated = uncached = 0
    hr_sources: Counter[str] = Counter()
    for a in store.all_activities():
        fit_path = _FIT_DIR / f"{a['id']}.fit"
        if not fit_path.exists():
            uncached += 1
            continue

        parsed = parse_fit(fit_path.read_bytes())
        if not parsed.has_data:
            continue

        type_inference = infer_type_with_source(
            a.get("description", ""),
            parsed,
            activity_id=a["id"],
            hr_zones=a.get("hrZones") or [],
            duration_seconds=a.get("durationSeconds"),
            date=a.get("date"),
            context=type_context,
        )
        a["type"] = type_inference.activity_type
        a["typeSource"] = type_inference.source
        a.update(stored_fit_fields(parsed, a.get("paceSecPerKm")))
        store.touch(a["id"])
        updated += 1
        hr_sources[parsed.hr_source or "none"] += 1

    if hr_sources:
        print("Heart rate by sensor: " + ", ".join(f"{source} {count}" for source, count in sorted(hr_sources.items())))
    if uncached:
        print(f"{uncached} activities have no cached FIT file and keep what they had: a forced sync downloads them.")
    if args.dry_run:
        print(f"Dry run: {updated} activities would be reprocessed (nothing written).")
        return 0

    store.save()

    print(f"{updated} activities reprocessed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
