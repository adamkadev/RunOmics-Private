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
from typing import TypeVar

import httpx

sys.path.insert(0, str(Path(__file__).parent))

from garmin.athlete import fetch_athlete_metrics, fetch_personal_athlete_metrics, record_athlete_history, vo2max_metrics
from data_directory import get_data_dir, get_fit_cache_dir
from garmin.client import GarminClient
from garmin.connect_status import record_connect_status
from garmin.cross_training import sync_cross_training
from garmin.errors import GarminAPIError, GarminAuthError, GarminTokenExpired
from garmin.personal_api import KEY_PAGE, PersonalApiClient
from garmin.fitness_age_history import sync_fitness_age_history
from garmin.listing_reconcile import Removal, refresh_names, remove_missing_runs
from garmin.retry import retry_transient
from garmin.race_predictions import sync_race_predictions
from garmin.recovery_history import sync_recovery_history
from garmin.series_freshness import series_freshness
from garmin import step_warnings
from garmin.training_plan import sync_training_plan
from garmin.threshold_history import sync_threshold_history
from garmin.training_status import sync_load_balance, sync_training_status
from garmin.vo2max_history import newest_carried_vo2max, sync_vo2max_from_runs, sync_vo2max_history
from garmin.vo2max_norms import fetch_vo2max_norms, write_vo2max_norms
from sync_workouts import enrich_description_from_plan, fetch_planned_workouts, planned_description, write_planned_workouts
from sync_upcoming_races import fetch_upcoming_races, write_upcoming_races
from processing.fit_parser import ParsedFit, parse_fit
from processing.mapper import extract_gear_id, local_start_time, map_activity, parse_hr_zones
from processing.activity_type import TypeContext, infer_type_with_source
from processing.type_context import load_type_context
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
    step_warnings.reset()

    # The Personal API key reads the activities, resting HR and the athlete's
    # zones. GARMIN_SECRET (garminconnect) adds what only Connect's private API
    # serves - gear, the calendar, training status, race predictions - and,
    # alone, reads everything as it did before the key existed.
    api_key = os.environ.get("GARMIN_PERSONAL_API_KEY", "").strip()
    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not api_key and not secret:
        print("Error: neither GARMIN_PERSONAL_API_KEY nor GARMIN_SECRET is set.", file=sys.stderr)
        print(f"Create a Personal API key at {KEY_PAGE} (see README.md).", file=sys.stderr)
        return 1

    quick = args.quick and bool(api_key)
    if args.quick and not quick:
        print("No GARMIN_PERSONAL_API_KEY: a quick sync reads through it alone, so this is a full sync.")

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
    type_context = load_type_context(_DATA_DIR)
    failed_steps: list[str] = []

    with ExitStack() as stack:
        # Either sign-in may fail while the other carries the night, which then
        # counts as partial. With nothing left to read the runs, it raises.
        personal = (
            _open_client(
                stack, "Personal API", lambda: PersonalApiClient(api_key), failed_steps, fallback=bool(secret) and not quick
            )
            if api_key
            else None
        )
        connect, connect_expired = (
            _open_connect(stack, secret, failed_steps, fallback=personal is not None, dry_run=args.dry_run)
            if secret and not quick
            else (None, False)
        )
        # Never None: _open_client raises when there is no fallback.
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
            rows = client.get_activity_rows(running_only=not args.all_types)
            all_ids = list(rows)
            if not args.dry_run:
                timed = sum(
                    store.set_start_time(aid, start)
                    for aid, row in rows.items()
                    if (start := local_start_time(row.get("startTimeLocal")))
                )
                if timed:
                    print(f"Start time filled in on {timed} stored activit{'y' if timed == 1 else 'ies'}.")
                renamed = refresh_names(
                    store,
                    rows,
                    describe=lambda name, day: planned_description(name, day, planned_store),
                    retype=lambda run: _retype(run, type_context),
                )
                if renamed:
                    print(f"Name refreshed on {renamed} stored activit{'y' if renamed == 1 else 'ies'}.")

            if args.force:
                new_ids = list(all_ids)
            else:
                new_ids = [aid for aid in all_ids if aid not in existing_ids]
            if args.limit:
                new_ids = new_ids[: args.limit]

        removal = Removal()
        added = updated = failed = 0
        # Runs the key read whose gear Connect did not answer: stored with the
        # shoe on file, offered to the gear refresh below, and the night counts
        # as partial. After the first, Connect is not asked again tonight.
        gear_unanswered: list[str] = []

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
                    gear = None
                    if connect and not gear_unanswered:
                        gear = _fetch_gear(connect, activity_id, required=client is connect)

                    time.sleep(_RATE_LIMIT_PAUSE)

                    weather = weather_for_activity(weather_client, parsed) if parsed else None

                    activity_data = map_activity(
                        detail, parsed, hr_zones=hr_zones, file_name=file_name, gear=gear,
                        weather=weather, type_context=type_context,
                    )
                    enrich_description_from_plan(activity_data, planned_store)
                except Exception as exc:
                    print(f"failed ({type(exc).__name__}: {exc})")
                    failed += 1
                    continue

                route_info = f"{len(activity_data.route)} pts" if activity_data.route else "no GPS"
                # The Actions log is world-readable: whether HR was recorded, never its value.
                hr_info = "HR" if activity_data.avg_heart_rate else "no HR"
                status = f"{activity_data.type}, {activity_data.distance_km} km, {hr_info}, {route_info}"

                if args.dry_run:
                    print(f"DRY RUN → {status}")
                    added += 1
                    continue

                is_new = store.upsert(
                    activity_data,
                    replace=args.force,
                    keep_gear=gear is None,
                    gear_pending=gear is None and bool(secret) and not connect_expired,
                    keep_zone_bounds=client is personal,
                )
                if connect and gear is None:
                    gear_unanswered.append(activity_id)
                if is_new:
                    added += 1
                    print(f"added   → {status}")
                else:
                    updated += 1
                    print(f"updated → {status}")

        if gear_unanswered:
            failed_steps.append(f"gear of {len(gear_unanswered)} run(s)")

        # Only a whole, unfiltered list says a run is gone; one cut by --limit or --id would read as deletions.
        if not args.id and not args.limit and not args.dry_run:
            removal = remove_missing_runs(client, store, rows)
            if removal.problem:
                failed_steps.append(removal.problem)

        regeared = 0
        if connect and not args.force and not args.id:
            regeared = _refresh_recent_gear(connect, store, skip=set(new_ids) - set(gear_unanswered))

        if not args.dry_run:
            store.save()
            print(f"\nDone: {added} added, {updated} updated, {regeared} gear refreshed, {failed} failed.")
            print(f"activities.json now has {store.count()} activities.")
        else:
            print(f"\nDry run: {added} would be added, {failed} would fail.")

        if not args.dry_run and not args.id:
            failed_steps += _run_isolated(
                _post_save_steps(connect, personal, store, cross_since=removal.retyped_since())
            )

        if not args.dry_run:
            # A quick or single-run sync reads none of Connect's series: the last full night's warnings stand.
            _write_sync_meta(None if quick or args.id else step_warnings.collected())

    if failed_steps:
        print(f"\n{len(failed_steps)} step(s) failed: {', '.join(failed_steps)}.")
    return 0 if failed == 0 and not failed_steps else _EXIT_PARTIAL_FAILURE


# What a sign-in that failed raises: a refused credential, Garmin or the
# network down, a secret that does not parse (a ValueError). Anything else is a bug, and stops the night like one.
_SIGN_IN_ERRORS = (GarminAuthError, GarminAPIError, httpx.HTTPError, OSError, ValueError)
_Client = TypeVar("_Client", PersonalApiClient, GarminClient)


def _open_client(
    stack: ExitStack, name: str, open_client: Callable[[], _Client], failed_steps: list[str], *, fallback: bool
) -> _Client | None:
    """One Garmin client entered into the run, or None when its sign-in fails
    and the other client can read the runs instead."""
    try:
        return stack.enter_context(open_client())
    except GarminTokenExpired:
        raise
    except _SIGN_IN_ERRORS as exc:
        if not fallback:
            raise
        print(f"Warning: {name} sign-in failed ({type(exc).__name__}: {exc}); carrying on without it.")
        failed_steps.append(f"{name} sign-in")
        return None


def _open_connect(
    stack: ExitStack, secret: str, failed_steps: list[str], *, fallback: bool, dry_run: bool
) -> tuple[GarminClient | None, bool]:
    """Connect's client, and whether its token has expired: then Connect is absent, not failing, so not partial."""
    try:
        connect = _open_client(stack, "Garmin Connect", lambda: GarminClient(secret), failed_steps, fallback=fallback)
    except GarminTokenExpired as exc:
        if not dry_run:
            record_connect_status(expired=True)
        if not fallback:
            raise
        print(f"Garmin Connect is gone: {exc}\nCarrying on without it; see 'Connect token expiry' in docs/data-and-sync.md.")
        return None, True
    if connect and (notice := connect.credential_notice()):
        print(f"Warning: {notice}")
    if connect and not dry_run:
        record_connect_status(expired=False)
    return connect, False


def _fetch_gear(connect: GarminClient, activity_id: str, *, required: bool) -> list[dict] | None:
    """The activity's gear ([] for none), or None when Connect did not answer.

    Only Connect knows it. When Connect also read the activity, an error
    fails the activity as any other would. When the Personal API read it,
    the run does not hang on Connect.
    """
    try:
        return retry_transient(connect.get_activity_gear, activity_id)
    except Exception as exc:
        if required:
            raise
        print(f"(gear unavailable: {type(exc).__name__})", end=" ", flush=True)
        return None


def _refresh_recent_gear(client: GarminClient, store: JsonActivityStore, *, skip: set[str]) -> int:
    """Only a successful answer may overwrite the stored gearId; a pending run has none to lose, so its 404 is an answer."""
    pending = set(store.get_gear_pending_ids())
    candidates = dict.fromkeys([*store.get_ids_since(_REGEAR_WINDOW_DAYS), *pending])
    recent_ids = [aid for aid in candidates if aid not in skip]
    if not recent_ids:
        return 0

    print(f"Refreshing gear for {len(recent_ids)} recent activit{'y' if len(recent_ids) == 1 else 'ies'}")
    changed = 0
    for activity_id in recent_ids:
        try:
            raw_gear = retry_transient(client.get_activity_gear, activity_id, strict_errors=activity_id not in pending)
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
    connect: GarminClient | None,
    personal: PersonalApiClient | None,
    store: JsonActivityStore,
    *,
    cross_since: date | None = None,
) -> list[Step]:
    """The steps after the activities, each from the API that serves it.

    Athlete metrics read both; resting HR comes from the Personal API when
    there is a key. Everything else is Connect's alone, and without a
    Connect session keeps what it last wrote - but VO2max, which the runs'
    own FIT readings carry on.
    """
    recovery_source: ActivitySource = personal or connect
    cross: list[Step] = [
        ("cross-training", lambda: sync_cross_training(recovery_source, store.get_existing_ids(), since=cross_since))
    ]
    athlete: list[Step] = [("athlete metrics", lambda: _sync_athlete_metrics(connect, personal))]
    recovery: list[Step] = [("recovery history", lambda: sync_recovery_history(recovery_source))]
    if connect is None:
        # The runs' own FIT readings keep VO2max current until Connect is back:
        # the series first, as the athlete's VO2max is read from it.
        return [*cross, ("VO2max history", lambda: sync_vo2max_from_runs(store.all_activities())), *athlete, *recovery]

    client = connect
    steps: list[Step] = [
        *cross,
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


def _retype(run: dict, type_context: TypeContext) -> dict | None:
    """Without its cached FIT a run keeps its type: inferring from the summary alone would drop Garmin's race flag."""
    fit_path = _FIT_DIR / f"{run['id']}.fit"
    parsed = parse_fit(fit_path.read_bytes()) if fit_path.exists() else None
    if not parsed or not parsed.has_data:
        return None
    inference = infer_type_with_source(
        run.get("description", ""),
        parsed,
        activity_id=run.get("id"),
        hr_zones=run.get("hrZones") or [],
        duration_seconds=run.get("durationSeconds"),
        date=run.get("date"),
        context=type_context,
    )
    return {"type": inference.activity_type, "typeSource": inference.source}


def _sync_planned_workouts(client: GarminClient, planned_store: PlannedWorkoutStore) -> None:
    planned, stale_candidates = fetch_planned_workouts(client)
    write_planned_workouts(planned, store=planned_store, stale_candidates=stale_candidates)


def _sync_athlete_metrics(connect: GarminClient | None, personal: PersonalApiClient | None) -> None:
    # Connect's are the fuller set (sex, height, threshold pace, VO2max, the
    # watch); where both have a value it is the same one. Without Connect,
    # VO2max follows the series carried on from the runs - only once a run
    # newer than Connect's last sample has moved it.
    metrics = fetch_personal_athlete_metrics(personal) if personal else {}
    carried = newest_carried_vo2max() if connect is None else None
    if carried:
        metrics.update(vo2max_metrics(carried))
    connect_failure: Exception | None = None
    if connect:
        try:
            metrics.update(fetch_athlete_metrics(connect))
        except Exception as exc:
            if not personal:
                raise
            # The Personal API's values are still written; the step still fails.
            connect_failure = exc
    # The history snapshots the athlete as now known: what this run fetched
    # over what is on file, so a value only Connect serves is not dropped
    # from the trend the first night without it.
    known = {**read_history(_ATHLETE_PATH), **metrics}
    if record_athlete_history(known):
        print("Athlete threshold metrics changed - recorded a history entry.")
    _merge_athlete_metrics(metrics)
    if connect_failure:
        raise connect_failure


def _first_activity_date(store: JsonActivityStore) -> date | None:
    """Earliest activity date - there is no training status worth having before it."""
    dates = [a["date"] for a in store.all_activities() if a.get("date")]
    return date.fromisoformat(min(dates)) if dates else None


def _write_sync_meta(warnings: list[dict[str, str]] | None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    previous = _read_sync_meta()
    kept = ("shoesCheckedAt", "warnings", "warningsAt") if warnings is None else ("shoesCheckedAt",)
    meta: dict = {"lastSyncedAt": now, **{key: previous[key] for key in kept if key in previous}}
    if warnings is not None:
        meta.update({"warnings": warnings, "warningsAt": now})
    meta["seriesFreshness"] = series_freshness(_DATA_DIR)
    write_history(_SYNC_META_PATH, meta)


def _read_sync_meta() -> dict:
    try:
        return read_history(_SYNC_META_PATH)
    except HistoryFileError:
        return {}


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
    parser.add_argument("--quick", action="store_true", help="Personal API key only, no Garmin Connect")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
