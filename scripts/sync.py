#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from garmin.client import GarminAuthError, GarminAPIError, GarminClient
from processing.fit_parser import ParsedFit, parse_fit
from processing.mapper import HrZone, extract_gear_id, map_activity, parse_hr_zones
from repository.json_store import JsonActivityStore

_FIT_DIR = Path(__file__).parent.parent / "public" / "fit"
_RATE_LIMIT_PAUSE = 1.0
_RETRY_PAUSE = 60.0
# Garmin gear assignment is often corrected a few days after upload, after the
# activity has already been synced - re-check gear (only) for recent activities
# on every run so those corrections aren't missed without a full --force resync.
_REGEAR_WINDOW_DAYS = 10


def main() -> int:
    args = _parse_args()

    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not secret:
        print("Error: GARMIN_SECRET environment variable is not set.", file=sys.stderr)
        print("Run scripts/get_secret.py to generate it.", file=sys.stderr)
        return 1

    _FIT_DIR.mkdir(parents=True, exist_ok=True)
    store = JsonActivityStore()
    existing_ids = store.get_existing_ids()
    print(f"activities.json: {store.count()} existing activities")

    with GarminClient(secret) as client:
        if args.id:
            new_ids = [args.id]
        else:
            print("Fetching activity list from Garmin Connect…")
            all_ids = client.get_all_activity_ids(running_only=not args.all_types)

            if args.force:
                new_ids = list(all_ids)
            else:
                new_ids = [aid for aid in all_ids if aid not in existing_ids]
            if args.limit:
                new_ids = new_ids[: args.limit]

        added = updated = failed = 0

        if not new_ids:
            print("No new activities to sync.")
        else:
            print(f"Syncing {len(new_ids)} new activit{'y' if len(new_ids) == 1 else 'ies'}…")

            for i, activity_id in enumerate(new_ids, 1):
                print(f"  [{i}/{len(new_ids)}] Activity {activity_id} …", end=" ", flush=True)

                try:
                    detail = _retry_on_429(lambda: client.get_activity_detail(activity_id))
                except GarminAPIError as exc:
                    print(f"failed ({exc})")
                    failed += 1
                    continue

                parsed, file_name = _fetch_track_file(client, activity_id, dry_run=args.dry_run)

                try:
                    raw_zones = _retry_on_429(lambda: client.get_hr_zones(activity_id))
                    hr_zones = parse_hr_zones(raw_zones)
                except GarminAPIError:
                    hr_zones = []

                try:
                    gear = _retry_on_429(lambda: client.get_activity_gear(activity_id))
                except GarminAPIError:
                    gear = []

                time.sleep(_RATE_LIMIT_PAUSE)

                activity_data = map_activity(
                    detail, parsed, hr_zones=hr_zones, file_name=file_name, gear=gear
                )

                route_info = f"{len(activity_data.route)} pts" if activity_data.route else "no GPS"
                hr_info = f"avg HR {activity_data.avg_heart_rate}" if activity_data.avg_heart_rate else "no HR"
                status = f"{activity_data.type}, {activity_data.distance_km} km, {hr_info}, {route_info}"

                if args.dry_run:
                    print(f"DRY RUN → {status}")
                    added += 1
                    continue

                is_new = store.upsert(activity_data, replace=args.force)
                if is_new:
                    added += 1
                    print(f"added   → {status}")
                else:
                    updated += 1
                    print(f"updated → {status}")

        regeared = 0
        if not args.force and not args.id:
            recent_ids = [aid for aid in store.get_ids_since(_REGEAR_WINDOW_DAYS) if aid not in new_ids]
            if recent_ids:
                print(
                    f"Refreshing gear for {len(recent_ids)} recent activit"
                    f"{'y' if len(recent_ids) == 1 else 'ies'}"
                )
                for activity_id in recent_ids:
                    try:
                        raw_gear = _retry_on_429(lambda: client.get_activity_gear(activity_id))
                    except GarminAPIError:
                        continue
                    if store.update_gear(activity_id, extract_gear_id(raw_gear)):
                        regeared += 1
                    time.sleep(_RATE_LIMIT_PAUSE)

        if not args.dry_run:
            store.save()
            print(f"\nDone: {added} added, {updated} updated, {regeared} gear refreshed, {failed} failed.")
            print(f"activities.json now has {store.count()} activities.")
        else:
            print(f"\nDry run: {added} would be added, {failed} would fail.")

        if not args.dry_run and not args.id:
            sync_planned_workouts(client)

    return 0 if failed == 0 else 2


def sync_planned_workouts(client: GarminClient) -> None:
    today = date.today()
    start = (today - timedelta(days=7)).isoformat()
    end = (today + timedelta(days=90)).isoformat()

    print(f"Syncing planned workouts {start} -> {end}…")

    try:
        schedule = _retry_on_429(lambda: client.get_workout_schedule(start, end))
    except GarminAPIError as exc:
        print(f"  Could not fetch workout schedule: {exc}")
        return

    planned: list[dict] = []
    seen_workout_ids: dict[str, str] = {}  # workoutId -> name cache

    for item in schedule:
        scheduled_date = item.get("scheduledDate", "")
        if not scheduled_date:
            continue

        # Only include running workouts
        workout_type_key = (
            item.get("workoutType", {}).get("workoutTypeKey", "") or
            item.get("sport", {}).get("sportTypeKey", "")
        ).lower()
        if workout_type_key and "running" not in workout_type_key:
            continue

        workout_id = str(item.get("workoutId", ""))

        # Try to get name from nested workout object first (avoids extra API call)
        name = item.get("workout", {}).get("workoutName", "")

        if not name and workout_id:
            if workout_id in seen_workout_ids:
                name = seen_workout_ids[workout_id]
            else:
                try:
                    detail = _retry_on_429(lambda: client.get_workout_detail(workout_id))
                    name = detail.get("workoutName", "")
                    time.sleep(_RATE_LIMIT_PAUSE)
                except GarminAPIError:
                    pass
                seen_workout_ids[workout_id] = name

        if not name:
            continue

        planned.append({"date": scheduled_date, "name": name})

    planned.sort(key=lambda x: x["date"])

    out_path = Path(__file__).parent.parent / "public" / "data" / "planned_workouts.json"
    out_path.write_text(json.dumps({"planned": planned}, ensure_ascii=False, indent=2))
    print(f"  {len(planned)} planned workout(s) written to planned_workouts.json")


def _retry_on_429(fn):
    try:
        return fn()
    except GarminAPIError as exc:
        if exc.status_code != 429:
            raise
        print(f"rate-limited, waiting {_RETRY_PAUSE}s…", flush=True)
        time.sleep(_RETRY_PAUSE)
        return fn()


def _fetch_track_file(
    client: GarminClient, activity_id: str, *, dry_run: bool
) -> tuple[ParsedFit | None, str | None]:
    fit_path = _FIT_DIR / f"{activity_id}.fit"
    if fit_path.exists():
        parsed = parse_fit(fit_path.read_bytes())
        if parsed.has_data:
            return parsed, fit_path.name

    try:
        fit_bytes = _retry_on_429(lambda: client.download_fit(activity_id))
    except GarminAPIError:
        return None, None

    if fit_bytes:
        parsed = parse_fit(fit_bytes)
        if parsed.has_data:
            if not dry_run:
                fit_path.write_bytes(fit_bytes)
            return parsed, fit_path.name

    return None, None


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync Garmin Connect activities into RunOmics"
    )
    parser.add_argument("--all-types", action="store_true")
    parser.add_argument("--limit", type=int, default=None, metavar="N")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--id", default=None, metavar="ACTIVITY_ID", help="Re-fetch a single activity by id")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
