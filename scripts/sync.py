#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import sys
import time
from collections.abc import Callable
from contextlib import ExitStack
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from garmin.athlete import fetch_athlete_metrics, fetch_personal_athlete_metrics, record_athlete_history
from data_directory import get_data_dir, get_fit_cache_dir
from garmin.client import GarminClient
from garmin.errors import GarminAuthError
from garmin.personal_api import PersonalApiClient
from garmin.fitness_age_history import sync_fitness_age_history
from garmin.retry import retry_transient
from garmin.race_predictions import sync_race_predictions
from garmin.recovery_history import sync_recovery_history
from garmin.training_plan import sync_training_plan
from garmin.threshold_history import sync_threshold_history
from garmin.training_status import sync_load_balance, sync_training_status
from garmin.vo2max_history import sync_vo2max_history
from garmin.vo2max_norms import fetch_vo2max_norms, write_vo2max_norms
from sync_workouts import enrich_description_from_plan, fetch_planned_workouts, write_planned_workouts
from sync_upcoming_races import fetch_upcoming_races, write_upcoming_races
from processing.fit_parser import ParsedFit, parse_fit
from processing.mapper import extract_gear_id, map_activity, parse_hr_zones
from processing.weather import WeatherClient, weather_for_activity
from repository.json_store import JsonActivityStore, PlannedWorkoutStore
from repository.history_file import HistoryFileError, read_history, write_history

_FIT_DIR = get_fit_cache_dir()
_DATA_DIR = get_data_dir()
_SYNC_META_PATH = _DATA_DIR / "sync_meta.json"
_ATHLETE_PATH = _DATA_DIR / "athlete.json"
_RATE_LIMIT_PAUSE = 1.0
_REGEAR_WINDOW_DAYS = 10

# "Some activities or steps failed; everything that succeeded is on disk" - the
# workflow commits it, then fails the run. Not 2: argparse already exits 2 for
# a usage error, and the workflow would read that as a partial failure and
# commit and deploy an unchanged workspace.
_EXIT_PARTIAL_FAILURE = 3

Step = tuple[str, Callable[[], object]]
ActivitySource = PersonalApiClient | GarminClient


def main() -> int:
    args = _parse_args()

    # The Personal API key reads the activities, resting HR and the athlete's
    # zones. GARMIN_SECRET (garth) adds what only Connect's private API
    # serves - gear, the calendar, training status, race predictions - and,
    # alone, reads everything as it did before the key existed.
    api_key = os.environ.get("GARMIN_PERSONAL_API_KEY", "").strip()
    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not api_key and not secret:
        print("Error: neither GARMIN_PERSONAL_API_KEY nor GARMIN_SECRET is set.", file=sys.stderr)
        print("Create a Personal API key at https://connect.garmin.com/app/settings/personalApiToken", file=sys.stderr)
        print("(see README.md).", file=sys.stderr)
        return 1

    _FIT_DIR.mkdir(parents=True, exist_ok=True)
    try:
        store = JsonActivityStore()
        planned_store = PlannedWorkoutStore()
    except HistoryFileError as exc:
        # Nothing has been fetched or written yet, so stopping here costs
        # one night; carrying on would rewrite the file from a partial view.
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    existing_ids = store.get_existing_ids()
    print(f"activities.json: {store.count()} existing activities")
    weather_client = WeatherClient()
    failed_steps: list[str] = []

    with ExitStack() as stack:
        personal = stack.enter_context(PersonalApiClient(api_key)) if api_key else None
        connect: GarminClient | None = None
        if secret:
            try:
                connect = stack.enter_context(GarminClient(secret))
            except GarminAuthError as exc:
                if personal is None:
                    raise
                # The activities come from the Personal API: a dead garth token
                # costs only what Connect alone serves, and says so every night.
                print(f"Warning: Garmin Connect sign-in failed; gear and Connect's metrics are skipped.\n{exc}")
                failed_steps.append("Garmin Connect sign-in")
        # Never None: without a key, a failed Connect sign-in raised above.
        client: ActivitySource = personal or connect

        # Fetched early (before the activity loop) so newly-synced activities can be
        # enriched against it below - but must not block the more important activity
        # sync if Garmin's calendar API hiccups, so it falls back to whatever's
        # already on disk rather than aborting the whole run. Like any other
        # step, a failure here still makes the night a partial one.
        if connect and not args.dry_run and not args.id:
            failed_steps += _run_isolated(
                [("planned workouts", lambda: _sync_planned_workouts(connect, planned_store))]
            )

        if args.id:
            new_ids = [args.id]
        else:
            source = "the Personal API" if personal else "Garmin Connect"
            print(f"Fetching activity list from {source}…")
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
                # not abort the run and lose everything synced before it. It
                # is not saved either: the next run fetches it again, where
                # storing it without its track, zones or gear was for good.
                # (An activity that has none of them gets a 404, which the
                # client reads as empty.)
                try:
                    detail = retry_transient(client.get_activity_detail, activity_id)
                    parsed, file_name = _fetch_track_file(client, activity_id, dry_run=args.dry_run)
                    hr_zones = parse_hr_zones(retry_transient(client.get_hr_zones, activity_id))
                    gear = retry_transient(connect.get_activity_gear, activity_id) if connect else None

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

                is_new = store.upsert(
                    activity_data, replace=args.force, keep_gear=connect is None, keep_zone_bounds=client is personal
                )
                if is_new:
                    added += 1
                    print(f"added   → {status}")
                else:
                    updated += 1
                    print(f"updated → {status}")

        regeared = 0
        if connect and not args.force and not args.id:
            regeared = _refresh_recent_gear(connect, store, skip=set(new_ids))

        if not args.dry_run:
            store.save()
            print(f"\nDone: {added} added, {updated} updated, {regeared} gear refreshed, {failed} failed.")
            print(f"activities.json now has {store.count()} activities.")
        else:
            print(f"\nDry run: {added} would be added, {failed} would fail.")

        if not args.dry_run and not args.id:
            failed_steps += _run_isolated(_post_save_steps(connect, personal, store))

        if not args.dry_run:
            _write_sync_meta()

    if failed_steps:
        print(f"\n{len(failed_steps)} step(s) failed: {', '.join(failed_steps)}.")
    return 0 if failed == 0 and not failed_steps else _EXIT_PARTIAL_FAILURE


def _refresh_recent_gear(client: GarminClient, store: JsonActivityStore, *, skip: set[str]) -> int:
    """Re-read the gear of the last days' activities; return how many changed.

    Picks up a shoe assigned in Garmin Connect after the activity was first
    synced. Only a successful answer may change what is stored, since "no
    gear" writes None over the gearId on file: strict_errors makes a 404
    raise like any other error, and an error of any kind - a network one
    included, which used to escape main() before store.save() and take the
    night's activities with it - keeps the stored value for the next run to
    ask again.
    """
    recent_ids = [aid for aid in store.get_ids_since(_REGEAR_WINDOW_DAYS) if aid not in skip]
    if not recent_ids:
        return 0

    print(f"Refreshing gear for {len(recent_ids)} recent activit{'y' if len(recent_ids) == 1 else 'ies'}")
    changed = 0
    for activity_id in recent_ids:
        try:
            raw_gear = retry_transient(client.get_activity_gear, activity_id, strict_errors=True)
        except Exception as exc:
            print(f"  Warning: gear of {activity_id} not refreshed ({type(exc).__name__}: {exc}); kept as stored.")
            continue
        if store.update_gear(activity_id, extract_gear_id(raw_gear)):
            changed += 1
        time.sleep(_RATE_LIMIT_PAUSE)
    return changed


def _run_isolated(steps: list[Step]) -> list[str]:
    """Run every step, whatever happens to the ones before it; return the names that failed.

    The activities are already saved by the time these run, and each step
    writes files of its own. One of them raising used to end main() with
    exit 1, which makes the workflow skip the commit - so a single 5xx from
    race predictions discarded every activity synced that night. Now a step
    that fails has written only what it completed, each file whole (and a
    history file that will not parse still refuses to be rewritten), the
    others carry on, and main() exits 3.
    """
    failed: list[str] = []
    for name, step in steps:
        try:
            step()
        except Exception as exc:
            print(f"Warning: {name} failed ({type(exc).__name__}: {exc})")
            failed.append(name)
    return failed


def _post_save_steps(
    connect: GarminClient | None, personal: PersonalApiClient | None, store: JsonActivityStore
) -> list[Step]:
    """The steps after the activities, each from the API that serves it.

    Athlete metrics read both; resting HR comes from the Personal API when
    there is a key. Everything else is Connect's alone, and without a
    Connect session keeps what it last wrote.
    """
    recovery_source: ActivitySource = personal or connect
    athlete: list[Step] = [("athlete metrics", lambda: _sync_athlete_metrics(connect, personal))]
    recovery: list[Step] = [("recovery history", lambda: sync_recovery_history(recovery_source))]
    if connect is None:
        return athlete + recovery

    client = connect
    steps: list[Step] = [
        ("upcoming races", lambda: write_upcoming_races(fetch_upcoming_races(client))),
        *athlete,
        ("fitness age history", lambda: sync_fitness_age_history(client)),
        ("VO2max norms", lambda: write_vo2max_norms(fetch_vo2max_norms(client))),
    ]

    first_day = _first_activity_date(store)
    if first_day:
        steps += [
            ("training status", lambda: sync_training_status(client, first_day)),
            ("VO2max history", lambda: sync_vo2max_history(client, first_day)),
            ("threshold history", lambda: sync_threshold_history(client, first_day)),
        ]

    return steps + [
        ("race predictions", lambda: sync_race_predictions(client)),
        *recovery,
        ("load balance", lambda: sync_load_balance(client)),
        ("training plan", lambda: sync_training_plan(client)),
    ]


def _sync_planned_workouts(client: GarminClient, planned_store: PlannedWorkoutStore) -> None:
    planned, stale_candidates = fetch_planned_workouts(client)
    write_planned_workouts(planned, store=planned_store, stale_candidates=stale_candidates)


def _sync_athlete_metrics(connect: GarminClient | None, personal: PersonalApiClient | None) -> None:
    # Connect's are the fuller set (sex, height, threshold pace, VO2max, the
    # watch); where both have a value it is the same one.
    metrics = fetch_personal_athlete_metrics(personal) if personal else {}
    if connect:
        metrics.update(fetch_athlete_metrics(connect))
    # The history snapshots the athlete as now known: what this run fetched
    # over what is on file, so a value only Connect serves is not dropped
    # from the trend the first night without it.
    known = {**read_history(_ATHLETE_PATH), **metrics}
    if record_athlete_history(known):
        print("Athlete threshold metrics changed - recorded a history entry.")
    _merge_athlete_metrics(metrics)


def _first_activity_date(store: JsonActivityStore) -> date | None:
    """Earliest activity date - there is no training status worth having before it."""
    dates = [a["date"] for a in store.all_activities() if a.get("date")]
    return date.fromisoformat(min(dates)) if dates else None


def _write_sync_meta() -> None:
    write_history(_SYNC_META_PATH, {"lastSyncedAt": datetime.now(timezone.utc).isoformat()})


def _merge_athlete_metrics(metrics: dict) -> None:
    if not metrics:
        return

    existing: dict = read_history(_ATHLETE_PATH)

    fetched_at = metrics.pop("lastUpdate", None)

    changed = any(existing.get(key) != value for key, value in metrics.items())

    merged = {**existing, **metrics}
    if changed and fetched_at:
        merged["lastUpdate"] = fetched_at

    write_history(_ATHLETE_PATH, dict(sorted(merged.items())))



def _fetch_track_file(
    client: ActivitySource, activity_id: str, *, dry_run: bool
) -> tuple[ParsedFit | None, str | None]:
    fit_path = _FIT_DIR / f"{activity_id}.fit"
    if fit_path.exists():
        parsed = parse_fit(fit_path.read_bytes())
        if parsed.has_data:
            return parsed, fit_path.name

    # None is an activity without a FIT file (a 404, or an archive holding
    # none). A download that fails, or one that decodes to nothing, raises
    # instead: storing the activity without its track would be for good.
    fit_bytes = retry_transient(client.download_fit, activity_id)
    if fit_bytes is None:
        return None, None

    parsed = parse_fit(fit_bytes)
    if not parsed.has_data:
        raise ValueError(f"the FIT file Garmin sent for activity {activity_id} holds nothing readable")
    if not dry_run:
        fit_path.write_bytes(fit_bytes)
    return parsed, fit_path.name


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
