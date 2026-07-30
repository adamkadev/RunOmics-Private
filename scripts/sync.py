#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from garmin.athlete import fetch_athlete_metrics, record_athlete_history
from garmin.client import GarminAuthError, GarminAPIError, GarminClient
from garmin.retry import retry_transient
from garmin.race_predictions import sync_race_predictions
from garmin.training_plan import sync_training_plan
from garmin.threshold_history import sync_threshold_history
from garmin.training_status import sync_load_balance, sync_training_status
from garmin.vo2max_history import sync_vo2max_history
from garmin.vo2max_norms import fetch_vo2max_norms, write_vo2max_norms
from sync_workouts import enrich_description_from_plan, fetch_planned_workouts, write_planned_workouts
from sync_upcoming_races import fetch_upcoming_races, write_upcoming_races
from processing.fit_parser import ParsedFit, parse_fit
from processing.mapper import HrZone, extract_gear_id, map_activity, parse_hr_zones
from processing.weather import WeatherClient, weather_for_activity
from repository.json_store import JsonActivityStore, PlannedWorkoutStore

_FIT_DIR = Path(__file__).parent.parent / "public" / "fit"
_SYNC_META_PATH = Path(__file__).parent.parent / "public" / "data" / "sync_meta.json"
_ATHLETE_PATH = Path(__file__).parent.parent / "public" / "data" / "athlete.json"
_RATE_LIMIT_PAUSE = 1.0
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
    planned_store = PlannedWorkoutStore()
    weather_client = WeatherClient()

    with GarminClient(secret) as client:
        # Fetched early (before the activity loop) so newly-synced activities can be
        # enriched against it below - but must not block the more important activity
        # sync if Garmin's calendar API hiccups, so it falls back to whatever's
        # already on disk rather than aborting the whole run.
        if not args.dry_run and not args.id:
            try:
                planned, stale_candidates = fetch_planned_workouts(client)
                write_planned_workouts(planned, store=planned_store, stale_candidates=stale_candidates)
            except Exception as exc:
                print(f"Warning: planned workouts sync failed ({type(exc).__name__}: {exc}), continuing with existing data.")

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

                # One bad activity (API error, corrupt FIT, mapping bug) must
                # not abort the run and lose everything synced before it.
                try:
                    detail = retry_transient(lambda: client.get_activity_detail(activity_id))

                    parsed, file_name = _fetch_track_file(client, activity_id, dry_run=args.dry_run)

                    try:
                        raw_zones = retry_transient(lambda: client.get_hr_zones(activity_id))
                        hr_zones = parse_hr_zones(raw_zones)
                    except GarminAPIError:
                        hr_zones = []

                    try:
                        gear = retry_transient(lambda: client.get_activity_gear(activity_id))
                    except GarminAPIError:
                        gear = []

                    time.sleep(_RATE_LIMIT_PAUSE)

                    weather = weather_for_activity(weather_client, parsed) if parsed else None

                    activity_data = map_activity(
                        detail, parsed, hr_zones=hr_zones, file_name=file_name, gear=gear,
                        weather=weather,
                    )
                    enrich_description_from_plan(activity_data, planned_store)
                except Exception as exc:
                    print(f"failed ({type(exc).__name__}: {exc})")
                    failed += 1
                    continue

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
                        raw_gear = retry_transient(lambda: client.get_activity_gear(activity_id))
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
            races = fetch_upcoming_races(client)
            write_upcoming_races(races)

            metrics = fetch_athlete_metrics(client)
            if record_athlete_history(metrics):
                print("Athlete threshold metrics changed - recorded a history entry.")
            _merge_athlete_metrics(metrics)

            write_vo2max_norms(fetch_vo2max_norms(client))

            first_day = _first_activity_date(store)
            if first_day:
                sync_training_status(client, first_day)
                sync_vo2max_history(client, first_day)
                sync_threshold_history(client, first_day)
            sync_race_predictions(client)
            sync_load_balance(client)
            sync_training_plan(client)

        if not args.dry_run:
            _write_sync_meta()

    return 0 if failed == 0 else 2


def _first_activity_date(store: JsonActivityStore) -> date | None:
    """Earliest activity date - there is no training status worth having before it."""
    dates = [a["date"] for a in store.all_activities() if a.get("date")]
    return date.fromisoformat(min(dates)) if dates else None


def _write_sync_meta() -> None:
    _SYNC_META_PATH.parent.mkdir(parents=True, exist_ok=True)
    _SYNC_META_PATH.write_text(
        json.dumps({"lastSyncedAt": datetime.now(timezone.utc).isoformat()}) + "\n"
    )


def _merge_athlete_metrics(metrics: dict) -> None:
    if not metrics:
        return

    existing: dict = {}
    if _ATHLETE_PATH.exists():
        existing = json.loads(_ATHLETE_PATH.read_text())

    fetched_at = metrics.pop("lastUpdate", None)

    changed = any(existing.get(key) != value for key, value in metrics.items())

    merged = {**existing, **metrics}
    if changed and fetched_at:
        merged["lastUpdate"] = fetched_at

    _ATHLETE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _ATHLETE_PATH.write_text(json.dumps(merged, indent=2, sort_keys=True) + "\n")



def _fetch_track_file(
    client: GarminClient, activity_id: str, *, dry_run: bool
) -> tuple[ParsedFit | None, str | None]:
    fit_path = _FIT_DIR / f"{activity_id}.fit"
    if fit_path.exists():
        parsed = parse_fit(fit_path.read_bytes())
        if parsed.has_data:
            return parsed, fit_path.name

    try:
        fit_bytes = retry_transient(lambda: client.download_fit(activity_id))
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
