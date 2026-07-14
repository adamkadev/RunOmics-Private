#!/usr/bin/env python3
"""Sync planned workouts from Garmin Connect to public/data/planned_workouts.json.

Fetches the calendar month-by-month to find scheduled running workouts,
then enriches each entry with the workout detail (name, estimated distance
and duration). Distance/duration are always derived by summing every step
(warm-up, main set, cool-down) rather than trusted from Garmin's top-level
`estimatedDistanceInMeters`/`estimatedDurationInSecs`: those have been
observed to cover only the main interval block for workouts created by
third-party plan providers (e.g. Decathlon Pacer / Kiprun), silently
dropping the warm-up and cool-down. Steps with no pace target (typical of
easy/footing time blocks) fall back to the athlete's own easy-zone pace
(see `_load_easy_pace_sec_per_km`) instead of contributing zero distance.

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
from processing.planned_workout_type import infer_planned_type

_DATA_DIR = Path(__file__).parent.parent / "public" / "data"
_RATE_LIMIT_PAUSE = 1.0
_RETRY_PAUSE = 60.0
_WINDOW_PAST_DAYS = 7
_WINDOW_FUTURE_DAYS = 90
_DEFAULT_SCHEDULED_TIME = "19:00"

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
            planned = fetch_planned_workouts(client)
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

    write_planned_workouts(planned)
    return 0


def write_planned_workouts(planned: list[dict]) -> None:
    """Write planned workouts to JSON, preserving manually-edited type/scheduledTime.

    `type` and `scheduledTime` can't be derived from Garmin's calendar/workout
    API, so once a value is set (manually, or by a prior sync's inference) it's
    kept across syncs even if the Garmin-side distance/duration changes for the
    *same* workout. But `type` is keyed off the workout name (see
    `infer_planned_type`), so it's only carried over when the name at that date
    is unchanged - otherwise the date just happens to hold a different session
    now (e.g. the plan was reordered/edited upstream) and the old type would be
    plain wrong for it.
    """
    out_path = _DATA_DIR / "planned_workouts.json"

    existing: dict[str, dict] = {}
    if out_path.exists():
        try:
            raw = json.loads(out_path.read_text())
            for entry in raw.get("planned", []):
                existing[entry["date"]] = entry
        except Exception:
            pass

    for entry in planned:
        prior = existing.get(entry["date"], {})
        prior_type = prior.get("type") if prior.get("name") == entry["name"] else None
        entry["type"] = prior_type or infer_planned_type(entry["name"])
        entry["scheduledTime"] = prior.get("scheduledTime", _DEFAULT_SCHEDULED_TIME)

    out_path.write_text(json.dumps({"planned": planned}, ensure_ascii=False, indent=2))
    print(f"  {len(planned)} planned workout(s) written to planned_workouts.json")


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


def fetch_planned_workouts(client: GarminClient) -> list[dict]:
    """Return a sorted list of planned workout entries for the rolling window."""
    today = date.today()
    start_date = today - timedelta(days=_WINDOW_PAST_DAYS)
    end_date = today + timedelta(days=_WINDOW_FUTURE_DAYS)

    print(f"Syncing planned workouts {start_date} -> {end_date}…")

    scheduled = _collect_scheduled(client, start_date, end_date)

    if not scheduled:
        print("  No running workouts found in calendar.")
        return []

    print(f"  Found {len(scheduled)} scheduled running workout(s), fetching details…")

    return _build_entries(client, scheduled)


def _collect_scheduled(
    client: GarminClient, start_date: date, end_date: date
) -> list[tuple[str, str]]:
    """Return (date, workoutId) pairs from the calendar for the given window."""
    months: list[tuple[int, int]] = []
    cur = start_date.replace(day=1)
    while cur <= end_date:
        months.append((cur.year, cur.month))
        cur = (cur + timedelta(days=32)).replace(day=1)

    seen: set[tuple[str, str]] = set()
    scheduled: list[tuple[str, str]] = []
    for year, month in months:
        try:
            data = _retry_on_429(
                lambda y=year, m=month: client.get_calendar_month(y, m)
            )
        except GarminAPIError as exc:
            print(f"  Warning: calendar {year}-{month:02d} failed: {exc}")
            continue

        for item in data.get("calendarItems", []):
            if item.get("itemType") != "workout":
                continue
            sched_date = item.get("date", "")
            if not sched_date:
                continue
            if sched_date < start_date.isoformat() or sched_date > end_date.isoformat():
                continue
            sport = (item.get("sport", "") or "").lower()
            if sport and "running" not in sport:
                continue
            workout_id = str(item.get("workoutId") or "")
            if not workout_id:
                continue
            # Garmin's calendar-service can list the same (date, workout) pair
            # twice (month grids overlap at week boundaries) - dedupe here.
            pair = (sched_date, workout_id)
            if pair not in seen:
                seen.add(pair)
                scheduled.append(pair)

    return scheduled


def _build_entries(
    client: GarminClient, scheduled: list[tuple[str, str]]
) -> list[dict]:
    """Fetch workout details and build the final entry list."""
    details_cache: dict[str, dict] = {}
    planned: list[dict] = []
    easy_pace = _load_easy_pace_sec_per_km()

    for sched_date, workout_id in scheduled:
        if workout_id not in details_cache:
            try:
                detail = _retry_on_429(
                    lambda wid=workout_id: client.get_workout_detail(wid)
                )
                details_cache[workout_id] = detail
                time.sleep(_RATE_LIMIT_PAUSE)
            except GarminAPIError as exc:
                print(f"  Warning: workout {workout_id} detail failed: {exc}")
                continue

        detail = details_cache[workout_id]
        name = (detail.get("workoutName") or "").strip()
        if " + " in name:
            name = name.split(" + ", 1)[0].strip()
        if not name:
            continue

        sport_key = (detail.get("sportType", {}).get("sportTypeKey") or "").lower()
        if sport_key and "running" not in sport_key:
            continue

        # Sum every step (warm-up, main set, cool-down) rather than trusting
        # Garmin's top-level estimate, which can silently cover only the main
        # interval block for third-party-provider workouts (see module docstring).
        steps = _collect_steps(detail)
        est_dist, est_dur = _estimate_from_steps(steps, easy_pace)
        dist_m = round(est_dist) if est_dist > 0 else detail.get("estimatedDistanceInMeters")
        dur_s = round(est_dur) if est_dur > 0 else detail.get("estimatedDurationInSecs")

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

        steps = _build_workout_steps(detail)
        if steps is not None:
            entry["steps"] = steps

        planned.append(entry)

    planned.sort(key=lambda x: x["date"])
    return planned


def _flatten_executable_steps(steps: list[dict]) -> list[dict]:
    """Recursively expand RepeatGroupDTO steps into their repeated
    ExecutableStepDTO children (e.g. "9 x 400m" -> 9 copies of interval+recovery)."""
    flat: list[dict] = []
    for step in steps:
        if step.get("type") == "RepeatGroupDTO":
            iterations = int(step.get("numberOfIterations") or 0)
            children = step.get("workoutSteps", [])
            for _ in range(iterations):
                flat.extend(_flatten_executable_steps(children))
        elif step.get("type") == "ExecutableStepDTO":
            flat.append(step)
    return flat


def _collect_steps(detail: dict) -> list[dict]:
    """Flatten all ExecutableStepDTO steps from all workout segments, expanding
    RepeatGroupDTO repeats into their repeated children - without this, an
    interval block like "9 x 400m" (a single RepeatGroupDTO) would vanish
    entirely from the distance/duration totals, since it isn't itself an
    ExecutableStepDTO."""
    top_level = [step for seg in detail.get("workoutSegments", []) for step in seg.get("workoutSteps", [])]
    return _flatten_executable_steps(top_level)


def _estimate_from_steps(steps: list[dict], fallback_pace_sec_per_km: float | None = None) -> tuple[float, float]:
    """Estimate total distance (m) and duration (s) from workoutSteps.

    For distance-condition steps, duration is estimated via target speed midpoint.
    For time-condition steps, distance is estimated via target speed midpoint.
    targetValueOne/Two are in m/s (Garmin pace zone speed values).

    Steps with no pace target (typical of open-ended easy/footing time
    blocks) fall back to `fallback_pace_sec_per_km` - the athlete's own
    easy-zone pace - instead of contributing zero distance.
    """
    total_dist = 0.0
    total_dur = 0.0
    fallback_speed = 1000 / fallback_pace_sec_per_km if fallback_pace_sec_per_km else None

    for step in steps:
        cond_key = (step.get("endCondition") or {}).get("conditionTypeKey", "")
        value = step.get("endConditionValue") or 0
        if isinstance(value, dict):
            value = value.get("parsedValue", 0)

        v1 = step.get("targetValueOne")
        v2 = step.get("targetValueTwo")
        speed = (v1 + v2) / 2 if v1 and v2 else None

        if cond_key == "distance":
            total_dist += value
            if speed and speed > 0:
                total_dur += value / speed
        elif cond_key == "time":
            total_dur += value
            step_speed = speed if speed and speed > 0 else fallback_speed
            if step_speed:
                total_dist += value * step_speed

    return total_dist, total_dur


# Garmin stepType.stepTypeKey -> RunOmics WorkoutStepKind. "other" and
# "interval" both denote a hard/main effort in Decathlon Pacer plans (the
# former inside a RepeatGroupDTO, the latter for a single continuous block).
_STEP_KIND_BY_TYPE_KEY = {
    "warmup": "warmup",
    "cooldown": "cooldown",
    "recovery": "recovery",
    "rest": "recovery",
    "interval": "effort",
    "other": "effort",
}


def _step_minutes(step: dict) -> float:
    """Duration of a single step in minutes, from its end condition."""
    cond_key = (step.get("endCondition") or {}).get("conditionTypeKey", "")
    value = step.get("endConditionValue") or 0
    if isinstance(value, dict):
        value = value.get("parsedValue", 0)

    if cond_key == "time":
        return value / 60

    if cond_key == "distance":
        v1 = step.get("targetValueOne")
        v2 = step.get("targetValueTwo")
        speed = (v1 + v2) / 2 if v1 and v2 else None
        return (value / speed) / 60 if speed and speed > 0 else 0

    return 0


def _step_pace_sec_per_km(step: dict) -> list[int] | None:
    """Real [fast, slow] target pace in sec/km, from a pace.zone target speed
    range in m/s. None for any other target type (e.g. heart-rate zone)."""
    target_key = (step.get("targetType") or {}).get("workoutTargetTypeKey", "")
    if target_key != "pace.zone":
        return None

    v1 = step.get("targetValueOne")
    v2 = step.get("targetValueTwo")
    if not v1 or not v2:
        return None

    paces = sorted([1000 / v1, 1000 / v2])
    return [round(paces[0]), round(paces[1])]


def _expand_step(step: dict, rep: int | None = None) -> list[dict]:
    """Flatten one Garmin workout step into 0-1 RunOmics WorkoutStep dicts,
    recursing into RepeatGroupDTO children once per iteration."""
    if step.get("type") == "RepeatGroupDTO":
        iterations = int(step.get("numberOfIterations") or 0)
        children = step.get("workoutSteps", [])
        expanded: list[dict] = []
        for i in range(1, iterations + 1):
            for child in children:
                expanded.extend(_expand_step(child, rep=i))
        return expanded

    kind = _STEP_KIND_BY_TYPE_KEY.get((step.get("stepType") or {}).get("stepTypeKey", ""))
    if kind is None:
        return []

    minutes = _step_minutes(step)
    if minutes <= 0:
        return []

    entry: dict = {"kind": kind, "minutes": int(minutes + 0.5)}
    if rep is not None:
        entry["rep"] = rep
    pace = _step_pace_sec_per_km(step)
    if pace is not None:
        entry["paceSecPerKm"] = pace
    return [entry]


def _build_workout_steps(detail: dict) -> list[dict] | None:
    """Real step-by-step structure from Garmin's workout detail, or None when
    there's nothing to show (a single continuous block, or no steps at all)."""
    raw_steps = [
        step for seg in detail.get("workoutSegments", []) for step in seg.get("workoutSteps", [])
    ]
    steps: list[dict] = []
    for step in raw_steps:
        steps.extend(_expand_step(step))

    # A standalone rest/recovery step at the very end of the workout (no rep
    # number, i.e. not one of the in-repeat recovery jogs from a RepeatGroupDTO)
    # is really the cool-down: Garmin's stepTypeKey "rest" is used for both, and
    # _STEP_KIND_BY_TYPE_KEY can't tell them apart from the key alone.
    if steps and steps[-1]["kind"] == "recovery" and "rep" not in steps[-1]:
        steps[-1]["kind"] = "cooldown"

    return steps if len(steps) > 1 else None


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
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
