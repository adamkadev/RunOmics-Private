#!/usr/bin/env python3
"""Sync planned workouts from Garmin Connect to public/data/planned_workouts/.

Fetches the calendar month-by-month to find scheduled running workouts, then
enriches each with its workout detail. The Garmin-payload parsing (distance/
duration estimation, step structure, main-set descriptor) lives in
processing/garmin_workout.py - this module only decides which detail to fetch
per calendar item and assembles/writes the final entries.

Can be run standalone or imported by sync.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from garmin.client import GarminAPIError, GarminAuthError, GarminClient
from processing.garmin_workout import (
    build_workout_steps,
    collect_steps,
    main_set_descriptor,
    resolve_adaptive_distance_duration,
    resolve_manual_distance_duration,
)
from processing.mapper import ActivityData
from processing.planned_workout_type import (
    coach_type_word,
    infer_planned_type,
    type_from_training_effect_label,
)
from repository.json_store import PlannedWorkoutStore

_DATA_DIR = Path(__file__).parent.parent / "public" / "data"
_RATE_LIMIT_PAUSE = 1.0
_RETRY_PAUSE = 60.0
_WINDOW_PAST_DAYS = 7
_WINDOW_FUTURE_DAYS = 90
_DEFAULT_SCHEDULED_TIME = "Evening"
_SCHEDULED_TIME_BUCKETS = ("Night", "Morning", "Afternoon", "Evening")


def _bucket_scheduled_time(value: str) -> str:
    """Coarsens an 'HH:MM' clock time to a time-of-day label, so the exact
    minute a future run is scheduled is never persisted or served publicly.
    Idempotent: an already-bucketed label passes through unchanged."""
    if value in _SCHEDULED_TIME_BUCKETS:
        return value
    try:
        hour = int(value.split(":", 1)[0])
    except (ValueError, IndexError):
        return _DEFAULT_SCHEDULED_TIME
    if 5 <= hour < 12:
        return "Morning"
    if 12 <= hour < 17:
        return "Afternoon"
    if 17 <= hour < 22:
        return "Evening"
    return "Night"

# Slow end of the "easy" training zone as a multiplier of threshold pace -
# mirrors ZONE_DEFS.easy.paceMultMax in src/application/usecases/GetTrainingZones.ts
# (the app's own "training zone chart"), so footing/endurance distance
# estimates line up with what the athlete sees there.
_EASY_PACE_MULT_MAX = 1.46
# Used only when the athlete's threshold pace isn't available - a generic
# slow-easy/footing pace, in line with the 5:45-6:15/km range most runners
# fall in for those sessions.
_DEFAULT_EASY_PACE_SEC_PER_KM = 375


def main() -> int:
    args = _parse_args()

    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not secret:
        print("Error: GARMIN_SECRET environment variable is not set.", file=sys.stderr)
        print("Run scripts/get_secret.py to generate it.", file=sys.stderr)
        return 1

    try:
        with GarminClient(secret) as client:
            planned, stale_candidates = fetch_planned_workouts(client, since=args.since, until=args.until)
    except GarminAuthError as exc:
        print(f"Auth error: {exc}", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"Dry run: {len(planned)} planned workout(s) found")
        for p in planned:
            dist = f"{p['distanceM'] / 1000:.1f} km" if p.get("distanceM") else ""
            dur = f"{p['durationSecs'] // 60} min" if p.get("durationSecs") else ""
            extra = " · ".join(filter(None, [dist, dur]))
            print(f"  {p['date']}  {p['name']}" + (f"  ({extra})" if extra else ""))
        return 0

    write_planned_workouts(planned, stale_candidates=stale_candidates)
    return 0


def write_planned_workouts(
    planned: list[dict],
    store: PlannedWorkoutStore | None = None,
    stale_candidates: set[str] | None = None,
) -> PlannedWorkoutStore:
    """Upsert this sync's fetch window into the durable per-year planned-workout
    store, preserving manually-edited type/scheduledTime.

    `scheduledTime`, and `type` for any workout Garmin doesn't label itself,
    can't be derived from the calendar/workout API - so once a value is set
    (manually, or by a prior sync's inference) it's kept across syncs even if
    the Garmin-side distance/duration changes for the *same* workout. But
    `type` is keyed off the workout name (see `infer_planned_type`), so it's
    only carried over when the name at that date is unchanged - otherwise the
    date just happens to hold a different session now (e.g. the plan was
    reordered/edited upstream) and the old type would be plain wrong for it.

    Unlike the old flat-file version, dates outside this sync's fetch window
    are left untouched in the store rather than dropped - the store is a
    growing history, not a rolling snapshot. But a date *inside* the window
    whose calendar month fetched cleanly and which no longer yields a running
    workout (rescheduled to another date, deleted, or turned into a rest day)
    is pruned via `stale_candidates` - otherwise a rescheduled session leaves
    a phantom entry on its old date forever (shown as a missed workout once
    that date is past).
    """
    store = store if store is not None else PlannedWorkoutStore()

    for entry in planned:
        prior = store.get(entry["date"]) or {}
        # A `type` already on the entry came from Garmin's own training-effect
        # label (Garmin Coach) - authoritative, so neither the prior value nor
        # the name-based guess gets a say.
        if not entry.get("type"):
            prior_type = prior.get("type") if prior.get("name") == entry["name"] else None
            entry["type"] = prior_type or infer_planned_type(entry["name"])
        entry["scheduledTime"] = _bucket_scheduled_time(prior.get("scheduledTime", _DEFAULT_SCHEDULED_TIME))
        store.upsert(entry)

    pruned = 0
    for stale_date in stale_candidates or ():
        if store.get(stale_date) is not None:
            store.delete(stale_date)
            pruned += 1

    store.save()
    summary = f"  {len(planned)} planned workout(s) upserted ({store.count()} total in store)"
    if pruned:
        summary += f", {pruned} stale entr{'y' if pruned == 1 else 'ies'} removed"
    print(summary)
    return store


def prefer_planned_name(description: str, plan: dict) -> str | None:
    planned_name = (plan.get("name") or "").strip()
    if not planned_name or planned_name == description:
        return None

    if len(planned_name) > len(description) and planned_name.lower().startswith(description.lower()):
        return planned_name

    # Garmin Coach titles a completed run "<City> - Base", which the mapper
    # trims to "Base": a title that names the session type and nothing else.
    # The plan for that same day, being that same type, is the only place its
    # actual structure survives. A custom rename matches neither branch.
    described_type = coach_type_word(description)
    if described_type and described_type == plan.get("type"):
        return planned_name

    return None


def enrich_description_from_plan(activity: ActivityData, store: PlannedWorkoutStore) -> None:
    """Mutates activity.description in place if the workout planned for
    activity.date describes the session better than the name Garmin gave it -
    so the detail survives permanently, independent of the store's window."""
    plan = store.get(activity.date)
    if not plan:
        return
    better = prefer_planned_name(activity.description, plan)
    if better:
        activity.description = better


def _load_easy_pace_sec_per_km(data_dir: Path = _DATA_DIR) -> float:
    """Slow-end easy/footing pace (sec/km), derived from the athlete's own
    threshold pace when available, else a generic 6'15/km default."""
    athlete_path = data_dir / "athlete.json"
    if athlete_path.exists():
        try:
            threshold = json.loads(athlete_path.read_text()).get("thresholdPaceSecPerKm")
            if threshold:
                return threshold * _EASY_PACE_MULT_MAX
        except Exception:
            pass
    return _DEFAULT_EASY_PACE_SEC_PER_KM


def fetch_planned_workouts(
    client: GarminClient, since: date | None = None, until: date | None = None
) -> tuple[list[dict], set[str]]:
    """Returns the planned entries plus `stale_candidates`: dates inside the
    fetch window, whose calendar month fetched successfully, that no longer
    have a running workout - i.e. safe for `write_planned_workouts` to prune
    from the store if it still holds an entry for them."""
    today = date.today()
    start_date = since or today - timedelta(days=_WINDOW_PAST_DAYS)
    end_date = until or today + timedelta(days=_WINDOW_FUTURE_DAYS)

    print(f"Syncing planned workouts {start_date} -> {end_date}…")

    scheduled, fetched_months = _collect_scheduled(client, start_date, end_date)

    if not scheduled:
        print("  No running workouts found in calendar.")
        planned: list[dict] = []
    else:
        print(f"  Found {len(scheduled)} scheduled running workout(s), fetching details…")
        planned = _build_entries(client, scheduled)

    covered = _dates_in_months(fetched_months, start_date, end_date)
    stale_candidates = covered - {entry["date"] for entry in planned}

    return planned, stale_candidates


def _dates_in_months(
    months: set[tuple[int, int]], start_date: date, end_date: date
) -> set[str]:
    dates: set[str] = set()
    cur = start_date
    while cur <= end_date:
        if (cur.year, cur.month) in months:
            dates.add(cur.isoformat())
        cur += timedelta(days=1)
    return dates


def _collect_scheduled(
    client: GarminClient, start_date: date, end_date: date
) -> tuple[list[tuple[str, str, str, bool]], set[tuple[int, int]]]:
    """Return (date, workoutId, fallbackTitle, isAdaptive) tuples from the
    calendar for the given window, plus the set of (year, month) that fetched
    successfully (used by the caller to know which dates are safe to prune a
    stale store entry from). fallbackTitle is the calendar item's own name
    - used when a workout's detail can't be fetched (see _build_entries).
    isAdaptive marks Garmin Coach items, whose detail comes from a different
    endpoint (see GarminClient.get_adaptive_workout_detail)."""
    months: list[tuple[int, int]] = []
    cur = start_date.replace(day=1)
    while cur <= end_date:
        months.append((cur.year, cur.month))
        cur = (cur + timedelta(days=32)).replace(day=1)

    seen: set[tuple[str, str]] = set()
    scheduled: list[tuple[str, str, str, bool]] = []
    fetched_months: set[tuple[int, int]] = set()
    # Diagnostics only (don't affect filtering) - surfaces in the sync's Actions
    # log why a calendar item was excluded, since e.g. Garmin Coach entries have
    # been reported missing from the synced plan with no other visible cause.
    item_type_counts: dict[str, int] = {}
    skipped_sports: list[str] = []
    skipped_no_workout_id = 0

    for year, month in months:
        try:
            data = _retry_on_429(
                lambda y=year, m=month: client.get_calendar_month(y, m)
            )
        except GarminAPIError as exc:
            print(f"  Warning: calendar {year}-{month:02d} failed: {exc}")
            continue

        fetched_months.add((year, month))

        for item in data.get("calendarItems", []):
            sched_date = item.get("date", "")
            in_window = bool(sched_date) and start_date.isoformat() <= sched_date <= end_date.isoformat()
            if in_window:
                item_type = item.get("itemType") or "(none)"
                item_type_counts[item_type] = item_type_counts.get(item_type, 0) + 1

            # Garmin Coach's adaptive training plans schedule "fbtAdaptiveWorkout"
            # items (Firstbeat-driven adaptive coaching), alongside plain
            # "workout" items used by manually-created/third-party-imported plans.
            if item.get("itemType") not in ("workout", "fbtAdaptiveWorkout"):
                continue
            if not sched_date or not in_window:
                continue
            sport = (item.get("sport", "") or "").lower()
            if sport and "running" not in sport:
                skipped_sports.append(sport)
                continue
            # fbtAdaptiveWorkout items have no numeric workoutId - they carry a
            # workoutUuid instead, resolved through the fbt-adaptive endpoint.
            is_adaptive = item.get("itemType") == "fbtAdaptiveWorkout"
            workout_id = str(item.get("workoutId") or item.get("workoutUuid") or "")
            if not workout_id:
                skipped_no_workout_id += 1
                continue
            # Garmin's calendar-service can list the same (date, workout) pair
            # twice (month grids overlap at week boundaries) - dedupe here.
            pair = (sched_date, workout_id)
            if pair not in seen:
                seen.add(pair)
                title = (item.get("title") or "").strip()
                scheduled.append((sched_date, workout_id, title, is_adaptive))

    if item_type_counts:
        breakdown = ", ".join(f"{k}={v}" for k, v in sorted(item_type_counts.items()))
        print(f"  Calendar items in window by itemType: {breakdown}")
    if skipped_sports:
        print(f"  Skipped {len(skipped_sports)} workout(s) with non-running sport: {sorted(set(skipped_sports))}")
    if skipped_no_workout_id:
        print(f"  Skipped {skipped_no_workout_id} workout(s) with no workoutId")

    return scheduled, fetched_months


def _build_entries(
    client: GarminClient, scheduled: list[tuple[str, str, str, bool]]
) -> list[dict]:
    """Fetch workout details and build the final entry list."""
    details_cache: dict[str, dict | None] = {}
    planned: list[dict] = []
    easy_pace = _load_easy_pace_sec_per_km()
    resolve_distance_duration = {
        True: resolve_adaptive_distance_duration,
        False: resolve_manual_distance_duration,
    }

    for sched_date, workout_id, fallback_title, is_adaptive in scheduled:
        if workout_id not in details_cache:
            fetch = (
                client.get_adaptive_workout_detail if is_adaptive
                else client.get_workout_detail
            )
            try:
                details_cache[workout_id] = _retry_on_429(
                    lambda wid=workout_id, f=fetch: f(wid)
                )
                time.sleep(_RATE_LIMIT_PAUSE)
            except GarminAPIError as exc:
                print(f"  Warning: workout {workout_id} detail failed: {exc}")
                details_cache[workout_id] = None

        detail = details_cache[workout_id]
        if detail is None:
            # No structured detail available - still show the session by
            # name/date rather than dropping it entirely.
            if fallback_title:
                planned.append({"date": sched_date, "name": fallback_title})
            continue

        # Garmin Coach schedules rest days as calendar items like any other
        # session, but with no name, no sport and no steps - they're plan
        # structure, not something to plan for.
        if detail.get("restDay") or detail.get("workoutPhrase") == "FORCED_REST":
            continue

        name = (detail.get("workoutName") or fallback_title).strip()
        if " + " in name:
            name = name.split(" + ", 1)[0].strip()
        if not name:
            continue

        sport_key = (detail.get("sportType", {}).get("sportTypeKey") or "").lower()
        if sport_key and "running" not in sport_key:
            continue

        steps = collect_steps(detail)
        dist_m, dur_s = resolve_distance_duration[is_adaptive](detail, steps, easy_pace)

        # Open/continuous workouts (no structured steps at all, e.g. a plain
        # "1h endurance" goal) sometimes have only one of distance/duration
        # filled in by Garmin - derive the other from the athlete's easy pace,
        # same fallback as the footing/endurance step case above.
        if not steps:
            if dist_m is None and dur_s is not None:
                dist_m = round(dur_s * 1000 / easy_pace)
            elif dur_s is None and dist_m is not None:
                dur_s = round(dist_m / 1000 * easy_pace)

        entry: dict = {"date": sched_date, "name": name}
        if dist_m is not None:
            entry["distanceM"] = int(dist_m)
        if dur_s is not None:
            entry["durationSecs"] = int(dur_s)

        workout_steps = build_workout_steps(detail)
        if workout_steps is not None:
            entry["steps"] = workout_steps

        # Garmin Coach's adaptive workouts state their own training-effect
        # target; that beats guessing the session type from a terse French
        # name. Third-party plans (Kiprun etc.) carry no such label.
        workout_type = type_from_training_effect_label(detail.get("trainingEffectLabel"))
        if workout_type:
            entry["type"] = workout_type

        # Garmin Coach names a session after its type and nothing else ("Base",
        # "Seuil"), which every view already shows as a badge right next to the
        # title - so its structure replaces the name outright ("3x8'@4:20").
        # Third-party plans name their sessions properly and keep that name; a
        # quality one just gains the main interval block. Base never gets a
        # structure - an easy run has none worth surfacing, so the canonical
        # word alone stays the name.
        coach_type = coach_type_word(name)
        if coach_type and not workout_type:
            # Once the type word leaves the name, the name-based guess
            # write_planned_workouts falls back to can't recover it.
            entry["type"] = coach_type

        if coach_type == "Base":
            entry["name"] = "Base"
        elif coach_type or (workout_type or infer_planned_type(name)) != "Base":
            main_set = main_set_descriptor(detail, name, workout_steps)
            if main_set:
                entry["name"] = main_set if coach_type else f"{name} - {main_set}"

        planned.append(entry)

    planned.sort(key=lambda x: x["date"])
    return planned


def _retry_on_429(fn):
    try:
        return fn()
    except GarminAPIError as exc:
        if exc.status_code != 429:
            raise
        print(f"  Rate limited, waiting {_RETRY_PAUSE}s…", flush=True)
        time.sleep(_RETRY_PAUSE)
        return fn()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync Garmin planned workouts into RunOmics"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--since",
        type=date.fromisoformat,
        metavar="YYYY-MM-DD",
        help=f"first date to fetch (default: {_WINDOW_PAST_DAYS} days ago)",
    )
    parser.add_argument(
        "--until",
        type=date.fromisoformat,
        metavar="YYYY-MM-DD",
        help=f"last date to fetch (default: {_WINDOW_FUTURE_DAYS} days ahead)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
