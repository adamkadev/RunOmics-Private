#!/usr/bin/env python3
"""Nightly in sync.yml; by hand to see a shoe added or retired in Garmin Connect before the next night."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from data_directory import get_data_dir
from garmin.client import GarminAuthError, GarminClient
from garmin.gear import fetch_shoe_gear, write_shoes_json
from repository.history_file import HistoryFileError, read_history, write_history


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

    if not args.dry_run:
        _record_checked()

    if not shoes:
        print("No shoe gear found on Garmin Connect.")
        return 0

    print(f"Found {len(shoes)} shoe(s):")
    for shoe in shoes:
        status = "retired" if shoe.retired else "active"
        print(f"  {shoe.brand} {shoe.model}  ({status}, max {shoe.max_km} km)  {shoe.gear_id}")

    if args.dry_run:
        print("\nDry run - preview of shoes.json:\n")
        print(json.dumps({"shoes": [shoe.to_dict() for shoe in shoes]}, indent=2))
        return 0

    # Passed on rather than left to write_shoes_json's default, which is resolved at import and could name another
    # workspace than the message.
    output_path = get_data_dir() / "shoes.json"
    if write_shoes_json(shoes, path=output_path):
        print(f"\n{output_path} updated - review it before pushing private data.")
    else:
        print(f"\n{output_path} already up to date.")

    return 0


def _record_checked() -> None:
    """In sync_meta.json, not shoes.json: a nightly date there would commit the shoe list every night."""
    path = get_data_dir() / "sync_meta.json"
    try:
        meta = read_history(path)
    except HistoryFileError:
        return
    if meta:
        write_history(path, {**meta, "shoesCheckedAt": datetime.now(timezone.utc).isoformat()})


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync shoe gear from Garmin Connect into SHOE_REGISTRY"
    )
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
