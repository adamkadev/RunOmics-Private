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

import httpx

from garmin.client import GarminAPIError, GarminAuthError, GarminClient
from garmin.retry import retry_transient
from garmin.step_warnings import warn
from data_directory import get_data_dir
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
    type_from_coaching_type,
    type_from_training_effect_label,
)
from repository.json_store import PlannedWorkoutStore

_RATE_LIMIT_PAUSE = 1.0
_WINDOW_PAST_DAYS = 7
_WINDOW_FUTURE_DAYS = 90
_DEFAULT_SCHEDULED_TIME = "Evening"
_SCHEDULED_TIME_BUCKETS = ("Night", "Morning", "Afternoon", "Evening")


class _Unresolved(dict):
    """A calendar item whose detail could not be fetched, reported rather than dropped so pruning cannot read the date as free."""


def _bucket_scheduled_time(value: str) -> str:
    """Coarsened so the exact minute a future run is scheduled is never persisted or served publicly."""
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

# Mirrors ZONE_DEFS.easy.paceMultMax in src/application/usecases/GetTrainingZones.ts, so easy distance estimates
# match the app's zone chart.
_EASY_PACE_MULT_MAX = 1.46
# 6:15/km, a generic slow-easy pace for when the athlete's threshold pace isn't available.
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
            name = f"{p['name']} (detail unavailable)" if isinstance(p, _Unresolved) else p["name"]
            print(f"  {p['date']}  {name}" + (f"  ({extra})" if extra else ""))
        return 0

    write_planned_workouts(planned, stale_candidates=stale_candidates)
    return 0


def write_planned_workouts(
    planned: list[dict],
    store: PlannedWorkoutStore | None = None,
    stale_candidates: set[str] | None = None,
) -> PlannedWorkoutStore:
    """`scheduledTime` and `type` cannot come from the Garmin API, so they are kept across syncs; `type` only while
    the name at that date is unchanged, since otherwise the date holds a different session.

    Stale candidates are pruned, or a rescheduled session would leave a phantom missed workout on its old date.
    """
    store = store if store is not None else PlannedWorkoutStore()

    written = kept = 0
    typed_at_source = {entry["date"] for entry in planned if entry.get("type")}
    for entry in planned:
        if isinstance(entry, _Unresolved):
            # What is on file is the last complete reading; a stub would stay so once the date leaves the window.
            if store.get(entry["date"]) is not None:
                kept += 1
                continue
            if not entry["name"]:
                continue
        written += 1
        prior = store.get(entry["date"]) or {}
        # A `type` already on the entry came from Garmin's label or the coaching plan, which no guess overrides.
        if not entry.get("type"):
            prior_type = prior.get("type") if prior.get("name") == entry["name"] else None
            entry["type"] = prior_type or infer_planned_type(entry["name"])
        entry["scheduledTime"] = _bucket_scheduled_time(prior.get("scheduledTime", _DEFAULT_SCHEDULED_TIME))
        store.upsert(entry)

    reclassified = _reclassify_base_entries(store, keep=typed_at_source)

    pruned = 0
    for stale_date in stale_candidates or ():
        if store.get(stale_date) is not None:
            store.delete(stale_date)
            pruned += 1

    store.save()
    summary = f"  {written} planned workout(s) upserted ({store.count()} total in store)"
    if kept:
        summary += f", {kept} kept as stored (detail unavailable)"
    if reclassified:
        summary += f", {reclassified} re-typed from Base by name"
    if pruned:
        summary += f", {pruned} stale entr{'y' if pruned == 1 else 'ies'} removed"
    print(summary)
    return store


def _reclassify_base_entries(store: PlannedWorkoutStore, keep: set[str] | frozenset[str] = frozenset()) -> int:
    """Across the whole history: Base is also the fallback for a name the rules could not read, so it would stay for good.

    `keep` holds the dates typed at the source - Garmin's own label or the coaching plan - which no name overrides."""
    reclassified = 0
    for entry in store.all_entries():
        if entry.get("type") not in (None, "Base") or entry["date"] in keep:
            continue
        guessed = infer_planned_type(entry.get("name") or "")
        if guessed != "Base":
            store.upsert({**entry, "type": guessed})
            reclassified += 1
    return reclassified


def prefer_planned_name(description: str, plan: dict) -> str | None:
    planned_name = (plan.get("name") or "").strip()
    if not planned_name or planned_name == description:
        return None

    if len(planned_name) > len(description) and planned_name.lower().startswith(description.lower()):
        return planned_name

    # Garmin Coach titles a run "<City> - Base", trimmed to "Base": the plan for that day is the only place its
    # structure survives.
    described_type = coach_type_word(description)
    if described_type and described_type == plan.get("type"):
        return planned_name

    return None


def enrich_description_from_plan(activity: ActivityData, store: PlannedWorkoutStore) -> None:
    """So the detail survives permanently, independent of the store's window."""
    activity.description = planned_description(activity.description, activity.date, store)


def planned_description(description: str, day: str, store: PlannedWorkoutStore) -> str:
    plan = store.get(day)
    return (prefer_planned_name(description, plan) if plan else None) or description


def _load_easy_pace_sec_per_km(data_dir: Path | None = None) -> float:
    athlete_path = (data_dir or get_data_dir()) / "athlete.json"
    if athlete_path.exists():
        try:
            threshold = json.loads(athlete_path.read_text(encoding="utf-8")).get("thresholdPaceSecPerKm")
            if threshold:
                return threshold * _EASY_PACE_MULT_MAX
        except Exception as exc:
            # Only an estimate hangs on it and nothing here writes the file, so falling back is safe.
            print(
                f"  Warning: {athlete_path} could not be read ({type(exc).__name__}: {exc}); "
                f"estimating distances at the default easy pace."
            )
    return _DEFAULT_EASY_PACE_SEC_PER_KM


def _pushed_prescriptions(data_dir: Path | None = None) -> dict[str, dict]:
    coaching = (data_dir or get_data_dir()) / "coaching"
    sync_path = coaching / "garmin-sync.json"
    if not sync_path.exists():
        return {}
    entries = json.loads(sync_path.read_text(encoding="utf-8")).get("entries") or []
    prescribed: dict[str, dict] = {}
    for plan_path in [coaching / "current_plan.json", *sorted((coaching / "superseded").glob("*.json"))]:
        if not plan_path.exists():
            continue
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        for week in plan.get("weeks") or []:
            for workout in week.get("workouts") or []:
                if workout.get("id"):
                    prescribed.setdefault(workout["id"], workout)

    pushed: dict[str, dict] = {}
    for entry in entries:
        workout = prescribed.get(entry.get("prescriptionId") or "")
        workout_id = str(entry.get("garminWorkoutId") or "")
        if workout and workout_id:
            pushed[workout_id] = workout
    return pushed


def _load_coach_workout_types(data_dir: Path | None = None) -> dict[str, str]:
    """A session the plan pushed is typed by the plan, not guessed from the free-text title the planner wrote for it."""
    try:
        pushed = _pushed_prescriptions(data_dir)
    except Exception as exc:
        # Only the type hangs on it, and the name-based guess still stands.
        print(
            f"  Warning: the coaching plan could not be read ({type(exc).__name__}: {exc}); "
            f"typing planned workouts from their names."
        )
        return {}

    types: dict[str, str] = {}
    for workout_id, workout in pushed.items():
        activity_type = type_from_coaching_type(workout.get("type"))
        if activity_type:
            types[workout_id] = activity_type
    return types


def _load_coach_named_workouts(data_dir: Path | None = None) -> set[str]:
    """A name the coach wrote under the naming rules (with a shortName) already states its main set."""
    try:
        pushed = _pushed_prescriptions(data_dir)
    except Exception:
        # _load_coach_workout_types has reported it already.
        return set()
    return {workout_id for workout_id, workout in pushed.items() if workout.get("shortName")}


def fetch_planned_workouts(
    client: GarminClient, since: date | None = None, until: date | None = None
) -> tuple[list[dict], set[str]]:
    """`stale_candidates` are dates in the window, in a month that fetched cleanly, with no running workout left."""
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
    """(date, workoutId, fallbackTitle, isAdaptive) tuples, plus the (year, month) pairs that fetched successfully."""
    months: list[tuple[int, int]] = []
    cur = start_date.replace(day=1)
    while cur <= end_date:
        months.append((cur.year, cur.month))
        cur = (cur + timedelta(days=32)).replace(day=1)

    seen: set[tuple[str, str]] = set()
    scheduled: list[tuple[str, str, str, bool]] = []
    fetched_months: set[tuple[int, int]] = set()
    # Diagnostics only: shows in the Actions log why a calendar item was excluded.
    item_type_counts: dict[str, int] = {}
    skipped_sports: list[str] = []
    skipped_no_workout_id = 0

    for year, month in months:
        try:
            data = retry_transient(client.get_calendar_month, year, month)
        except (GarminAPIError, httpx.HTTPError) as exc:
            warn("planned workouts", f"calendar {year}-{month:02d} failed: {exc}")
            continue

        fetched_months.add((year, month))

        for item in data.get("calendarItems", []):
            sched_date = item.get("date", "")
            in_window = bool(sched_date) and start_date.isoformat() <= sched_date <= end_date.isoformat()
            if in_window:
                item_type = item.get("itemType") or "(none)"
                item_type_counts[item_type] = item_type_counts.get(item_type, 0) + 1

            # Garmin Coach schedules "fbtAdaptiveWorkout" items; manual and third-party plans plain "workout" items.
            if item.get("itemType") not in ("workout", "fbtAdaptiveWorkout"):
                continue
            if not sched_date or not in_window:
                continue
            sport = (item.get("sport", "") or "").lower()
            if sport and "running" not in sport:
                skipped_sports.append(sport)
                continue
            # fbtAdaptiveWorkout items carry a workoutUuid instead of a numeric workoutId.
            is_adaptive = item.get("itemType") == "fbtAdaptiveWorkout"
            workout_id = str(item.get("workoutId") or item.get("workoutUuid") or "")
            if not workout_id:
                skipped_no_workout_id += 1
                continue
            # Garmin's calendar lists a pair twice where month grids overlap at week boundaries.
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
    details_cache: dict[str, dict | None] = {}
    planned: list[dict] = []
    easy_pace = _load_easy_pace_sec_per_km()
    coach_types = _load_coach_workout_types()
    coach_named = _load_coach_named_workouts()
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
                details_cache[workout_id] = retry_transient(fetch, workout_id)
                time.sleep(_RATE_LIMIT_PAUSE)
            except (GarminAPIError, httpx.HTTPError) as exc:
                warn("planned workouts", f"workout {workout_id} detail failed: {exc}")
                details_cache[workout_id] = None

        detail = details_cache[workout_id]
        if detail is None:
            # Reported by name and date, so the date is not mistaken for a free one.
            planned.append(_Unresolved(date=sched_date, name=fallback_title))
            continue

        # Garmin Coach schedules rest days as calendar items, with no name, sport or steps.
        if detail.get("restDay") or detail.get("workoutPhrase") == "FORCED_REST":
            continue

        name = (detail.get("workoutName") or fallback_title).strip()
        # A name the coach wrote under the naming rules is kept as written: its "+ 6 strides" is part of it.
        named_by_coach = workout_id in coach_named
        if " + " in name and not named_by_coach:
            name = name.split(" + ", 1)[0].strip()
        if not name:
            continue

        sport_key = (detail.get("sportType", {}).get("sportTypeKey") or "").lower()
        if sport_key and "running" not in sport_key:
            continue

        steps = collect_steps(detail)
        dist_m, dur_s = resolve_distance_duration[is_adaptive](detail, steps, easy_pace)

        # Garmin sometimes fills only one of distance/duration for a workout with no steps.
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

        # Garmin Coach's own training-effect target beats guessing from a terse French name; third-party plans carry
        # no such label.
        workout_type = type_from_training_effect_label(detail.get("trainingEffectLabel")) or coach_types.get(workout_id)
        if workout_type:
            entry["type"] = workout_type

        # Garmin Coach names a session after its type alone, already shown as a badge, so its structure replaces the
        # name; a third-party name is kept, and an easy run has no structure worth surfacing.
        coach_type = coach_type_word(name)
        if coach_type and not workout_type:
            # Once the type word leaves the name, the name-based guess can't recover it.
            entry["type"] = coach_type

        if named_by_coach:
            # It already states its main set; appending ours would say it twice.
            pass
        elif coach_type == "Base":
            entry["name"] = "Base"
        elif coach_type or (workout_type or infer_planned_type(name)) != "Base":
            main_set = main_set_descriptor(detail, name, workout_steps)
            if main_set:
                entry["name"] = main_set if coach_type else f"{name} - {main_set}"

        planned.append(entry)

    planned.sort(key=lambda x: x["date"])
    return planned


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
