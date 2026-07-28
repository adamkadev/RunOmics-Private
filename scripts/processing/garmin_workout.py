"""Turn a Garmin Connect workout-detail payload into RunOmics' planned-workout
fields: distance, duration, step-by-step structure, and a compact descriptor
for the main set.

Pure functions only - no I/O, no GarminClient - so sync_workouts.py just picks
which detail to fetch and assembles the final entry from what's returned here.
"""

from __future__ import annotations

import re


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


def collect_steps(detail: dict) -> list[dict]:
    """Flatten all ExecutableStepDTO steps from all workout segments, expanding
    RepeatGroupDTO repeats into their repeated children - without this, an
    interval block like "9 x 400m" (a single RepeatGroupDTO) would vanish
    entirely from the distance/duration totals, since it isn't itself an
    ExecutableStepDTO."""
    top_level = [step for seg in detail.get("workoutSegments", []) for step in seg.get("workoutSteps", [])]
    return _flatten_executable_steps(top_level)


def estimate_from_steps(steps: list[dict], fallback_pace_sec_per_km: float | None = None) -> tuple[float, float]:
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


def resolve_adaptive_distance_duration(
    detail: dict, steps: list[dict], easy_pace: float
) -> tuple[float | None, float | None]:
    """Distance/duration for a Garmin Coach adaptive workout: its own
    top-level estimate is first-party and can be trusted outright - unlike
    third-party providers (see `resolve_manual_distance_duration`), it isn't
    known to silently cover only the main interval block. Only reconstruct
    from steps to fill in a gap."""
    dist_m = detail.get("estimatedDistanceInMeters")
    dur_s = detail.get("estimatedDurationInSecs")
    if dist_m is None or dur_s is None:
        est_dist, est_dur = estimate_from_steps(steps, easy_pace)
        if dist_m is None and est_dist > 0:
            dist_m = round(est_dist)
        if dur_s is None and est_dur > 0:
            dur_s = round(est_dur)
    return dist_m, dur_s


def resolve_manual_distance_duration(
    detail: dict, steps: list[dict], easy_pace: float
) -> tuple[float | None, float | None]:
    """Distance/duration for a third-party/manually-created plan (Decathlon
    Pacer, Kiprun, ...): sum every step (warm-up, main set, cool-down) rather
    than trusting Garmin's top-level estimate, which has been observed to
    cover only the main interval block for these providers, silently dropping
    the warm-up and cool-down."""
    est_dist, est_dur = estimate_from_steps(steps, easy_pace)
    dist_m = round(est_dist) if est_dist > 0 else detail.get("estimatedDistanceInMeters")
    dur_s = round(est_dur) if est_dur > 0 else detail.get("estimatedDurationInSecs")
    return dist_m, dur_s


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


def build_workout_steps(detail: dict) -> list[dict] | None:
    """Real step-by-step structure from Garmin's workout detail, or None when
    there are no steps at all. A single continuous block (e.g. a plain "Base"
    run with just a pace-zone target - same shape Garmin Connect itself shows
    as one estimated pace range) is still returned as a length-1 list: the
    frontend's WorkoutStepList already renders a lone effort step as "X' @
    pace", so every workout type gets the same distance/duration/pace fields
    rather than only structured interval sessions."""
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

    return steps or None


# Garmin Coach's `description` is a terse structure summary ("3x8:00@4:20/km").
# Anything longer is prose from some other provider, not a descriptor - and a
# descriptor that's already in the name would just duplicate it.
_MAX_DESCRIPTOR_LEN = 40

_REP_STRUCTURE_RE = re.compile(r"\d\s*[x×]\s*\d")


def has_rep_structure(text: str) -> bool:
    """Whether `text` states a repeated block ("3x8:00@4:20/km", "10x400m")
    rather than a lone target pace ("4:20/km") or prose."""
    return bool(_REP_STRUCTURE_RE.search(text))


def main_set_descriptor(detail: dict, name: str, steps: list[dict] | None) -> str | None:
    """Compact summary of a workout's main set, for use as its title.

    Garmin's own `description` wins when it states a rep structure: it's
    authoritative about reps expressed in seconds or in metres, which
    `steps_descriptor` can only render as whole minutes. A description that is
    nothing but a target pace says strictly less than the steps do."""
    description = (detail.get("description") or "").strip()
    if has_rep_structure(description) and len(description) <= _MAX_DESCRIPTOR_LEN:
        if description.lower() not in name.lower():
            return normalize_descriptor(description)
        return None

    return steps_descriptor(steps) if steps else None


# A rep duration Garmin writes as M:SS. Never the pace, which is always written
# right after an "@" - and would otherwise be mangled into "4'20".
_REP_DURATION_RE = re.compile(r"(?<![@\d])(\d+):(\d{2})\b")


def normalize_descriptor(description: str) -> str:
    """Garmin's own descriptor in RunOmics' compact form: "3x8:00@4:20/km" ->
    "3x8'@4:20". The unit is implied by the pace itself, and a bare "8:00"
    reads as a clock time where a rep duration is meant."""
    return _REP_DURATION_RE.sub(_rep_duration, description.replace("/km", "")).strip()


def _rep_duration(match: re.Match[str]) -> str:
    minutes, seconds = int(match.group(1)), int(match.group(2))
    if seconds == 0:
        return f"{minutes}'"
    if minutes == 0:
        return f'{seconds}"'
    return f"{minutes}'{seconds:02d}"


def steps_descriptor(steps: list[dict]) -> str | None:
    """Compact summary of a workout's main effort: "3x8'@4:20" for three
    8-minute reps at 4:20/km, "17'@4:20" for a single continuous block.
    None for a lone effort without a target pace (duration is already a field),
    or when there is no effort step at all."""
    efforts = [s for s in steps if s.get("kind") == "effort"]
    if not efforts:
        return None

    reps = [s for s in efforts if "rep" in s]
    if reps:
        first = next(s for s in reps if s["rep"] == 1)
        return f"{max(s['rep'] for s in reps)}x{_effort_descriptor(first)}"

    # A lone steady block without a pace target has nothing to say beyond
    # the duration field; the type badge alone (e.g. "Base") is enough.
    if "paceSecPerKm" not in efforts[0]:
        return None
    return _effort_descriptor(efforts[0])


def _effort_descriptor(step: dict) -> str:
    pace = step.get("paceSecPerKm")
    return f"{step['minutes']}'" + (f"@{_format_pace_mmss(pace)}" if pace else "")


def _format_pace_mmss(pace_range: list[int]) -> str:
    """Midpoint of a [fast, slow] sec/km target range as "M:SS", matching the
    single pace value Garmin's own UI shows for a pace.zone target."""
    mid = round(sum(pace_range) / 2)
    return f"{mid // 60}:{mid % 60:02d}"
