"""Shared builders for fake Garmin workout-step payloads, used by
test_garmin_workout.py (unit tests on the parsing/estimation functions) and
test_sync_workouts.py (integration tests through _build_entries)."""


def pace_zone_step(kind_key: str, cond_key: str, value, fast_sec_per_km: int, slow_sec_per_km: int) -> dict:
    """Build a raw Garmin ExecutableStepDTO with a pace.zone target."""
    return {
        "type": "ExecutableStepDTO",
        "stepType": {"stepTypeKey": kind_key},
        "endCondition": {"conditionTypeKey": cond_key},
        "endConditionValue": value,
        "targetType": {"workoutTargetTypeKey": "pace.zone"},
        "targetValueOne": 1000 / slow_sec_per_km,  # slower speed
        "targetValueTwo": 1000 / fast_sec_per_km,  # faster speed
    }


def open_time_step(kind_key: str, seconds: float) -> dict:
    """A time-based step with no pace/speed target (e.g. a plain footing block)."""
    return {
        "type": "ExecutableStepDTO",
        "stepType": {"stepTypeKey": kind_key},
        "endCondition": {"conditionTypeKey": "time"},
        "endConditionValue": seconds,
    }


def repeat_group(iterations: int, children: list[dict]) -> dict:
    return {"type": "RepeatGroupDTO", "numberOfIterations": iterations, "workoutSteps": children}


def detail_with_steps(*top_level_steps: dict) -> dict:
    return {"workoutSegments": [{"workoutSteps": list(top_level_steps)}]}
