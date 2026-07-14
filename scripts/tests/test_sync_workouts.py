import json

from sync_workouts import (
    _DEFAULT_EASY_PACE_SEC_PER_KM,
    _build_entries,
    _build_workout_steps,
    _estimate_from_steps,
    _load_easy_pace_sec_per_km,
)


def _pace_zone_step(kind_key: str, cond_key: str, value, fast_sec_per_km: int, slow_sec_per_km: int) -> dict:
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


def _open_time_step(kind_key: str, seconds: float) -> dict:
    """A time-based step with no pace/speed target (e.g. a plain footing block)."""
    return {
        "type": "ExecutableStepDTO",
        "stepType": {"stepTypeKey": kind_key},
        "endCondition": {"conditionTypeKey": "time"},
        "endConditionValue": seconds,
    }


def _repeat_group(iterations: int, children: list[dict]) -> dict:
    return {"type": "RepeatGroupDTO", "numberOfIterations": iterations, "workoutSteps": children}


def _detail_with_steps(*top_level_steps: dict) -> dict:
    return {"workoutSegments": [{"workoutSteps": list(top_level_steps)}]}


class TestEstimateFromSteps:
    def test_sums_warmup_main_and_cooldown(self):
        # Mirrors the "9 x 400m (R=1min)" Kiprun session: 20' warm-up,
        # 9x400m @ 3'45/km with 1' easy jog recovery, 10' cool-down.
        steps = [
            _pace_zone_step("warmup", "time", 20 * 60, 346, 375),
            *[
                s
                for i in range(9)
                for s in (
                    _pace_zone_step("interval", "distance", 400, 225, 225),
                    _pace_zone_step("recovery", "time", 60, 375, 375),
                )
            ],
            _pace_zone_step("cooldown", "time", 10 * 60, 375, 375),
        ]

        total_dist, total_dur = _estimate_from_steps(steps)

        interval_secs = 400 / (1000 / 225)  # distance / speed
        # Warm-up + 9x400m + 9x1' recovery + cool-down: none of it should be dropped.
        assert total_dur == 20 * 60 + 9 * interval_secs + 9 * 60 + 10 * 60
        assert total_dist > 9 * 400  # warm-up/cool-down/recovery jogging adds real km on top of the 9x400m

    def test_time_step_without_pace_target_uses_fallback_pace(self):
        steps = [_open_time_step("interval", 45 * 60)]

        total_dist, total_dur = _estimate_from_steps(steps, fallback_pace_sec_per_km=375)

        assert total_dur == 45 * 60
        assert total_dist == (45 * 60) * (1000 / 375)

    def test_time_step_without_pace_target_and_no_fallback_contributes_zero_distance(self):
        steps = [_open_time_step("interval", 45 * 60)]

        total_dist, total_dur = _estimate_from_steps(steps)

        assert total_dur == 45 * 60
        assert total_dist == 0

    def test_no_steps_returns_zero(self):
        assert _estimate_from_steps([]) == (0.0, 0.0)


class TestLoadEasyPaceSecPerKm:
    def test_uses_athlete_threshold_pace_when_available(self, tmp_path):
        (tmp_path / "athlete.json").write_text(json.dumps({"thresholdPaceSecPerKm": 254}))

        pace = _load_easy_pace_sec_per_km(tmp_path)

        assert pace == 254 * 1.46

    def test_falls_back_to_default_when_no_athlete_file(self, tmp_path):
        assert _load_easy_pace_sec_per_km(tmp_path) == _DEFAULT_EASY_PACE_SEC_PER_KM

    def test_falls_back_to_default_when_threshold_missing(self, tmp_path):
        (tmp_path / "athlete.json").write_text(json.dumps({}))

        assert _load_easy_pace_sec_per_km(tmp_path) == _DEFAULT_EASY_PACE_SEC_PER_KM


class TestBuildWorkoutSteps:
    def test_trailing_standalone_rest_step_is_relabeled_cooldown(self):
        # Garmin's stepTypeKey "rest" is used both for the in-repeat recovery
        # jog and, in Decathlon Pacer/Kiprun plans, for the final cool-down -
        # RunOmics can only tell them apart by position (standalone vs. inside
        # the RepeatGroupDTO).
        detail = _detail_with_steps(
            _pace_zone_step("warmup", "time", 20 * 60, 346, 375),
            _repeat_group(
                9,
                [
                    _pace_zone_step("interval", "distance", 400, 225, 225),
                    _pace_zone_step("rest", "time", 60, 375, 375),
                ],
            ),
            _pace_zone_step("rest", "time", 10 * 60, 375, 375),
        )

        steps = _build_workout_steps(detail)

        assert steps[0]["kind"] == "warmup"
        assert steps[-1]["kind"] == "cooldown"
        assert "rep" not in steps[-1]
        # The 9 in-repeat recovery jogs keep their "recovery" kind and rep number.
        in_repeat_recoveries = [s for s in steps if s["kind"] == "recovery"]
        assert len(in_repeat_recoveries) == 9
        assert all("rep" in s for s in in_repeat_recoveries)

    def test_already_typed_cooldown_step_is_left_alone(self):
        detail = _detail_with_steps(
            _pace_zone_step("warmup", "time", 20 * 60, 346, 375),
            _pace_zone_step("interval", "time", 20 * 60, 240, 240),
            _pace_zone_step("cooldown", "time", 10 * 60, 375, 375),
        )

        steps = _build_workout_steps(detail)

        assert steps[-1]["kind"] == "cooldown"

    def test_no_trailing_standalone_step_leaves_last_in_repeat_recovery_alone(self):
        # Workout ends right on the last recovery jog inside the repeat group -
        # there's no separate cool-down to infer, so it must stay "recovery".
        detail = _detail_with_steps(
            _pace_zone_step("warmup", "time", 20 * 60, 346, 375),
            _repeat_group(
                3,
                [
                    _pace_zone_step("interval", "distance", 400, 225, 225),
                    _pace_zone_step("rest", "time", 60, 375, 375),
                ],
            ),
        )

        steps = _build_workout_steps(detail)

        assert steps[-1]["kind"] == "recovery"
        assert steps[-1]["rep"] == 3


class _FakeClient:
    """Minimal stand-in for GarminClient.get_workout_detail used by _build_entries."""

    def __init__(self, detail: dict):
        self._detail = detail

    def get_workout_detail(self, workout_id):
        return self._detail


class TestBuildEntriesPrefersStepSum:
    def test_ignores_garmins_incomplete_top_level_estimate(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        # Garmin's own estimatedDistanceInMeters/estimatedDurationInSecs cover
        # only the main 9x400m block (the exact bug from the bug report),
        # while the full step list includes a 20' warm-up and 10' cool-down.
        detail = {
            "workoutName": "9 x 400m (R=1 min)",
            "sportType": {"sportTypeKey": "running"},
            "estimatedDistanceInMeters": 4933,
            "estimatedDurationInSecs": 1800,
            "workoutSegments": [
                {
                    "workoutSteps": [
                        _pace_zone_step("warmup", "time", 20 * 60, 346, 375),
                        _pace_zone_step("interval", "distance", 400, 225, 225),
                        _pace_zone_step("recovery", "time", 60, 375, 375),
                        _pace_zone_step("cooldown", "time", 10 * 60, 375, 375),
                    ]
                }
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-14", "123")])

        assert len(entries) == 1
        entry = entries[0]
        # Full sum (warm-up + interval + recovery + cool-down) is well above
        # Garmin's 30 min / 4.9 km top-level estimate.
        assert entry["durationSecs"] > 1800
        assert entry["distanceM"] > 4933

    def test_falls_back_to_garmin_top_level_when_no_steps(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Easy run",
            "sportType": {"sportTypeKey": "running"},
            "estimatedDistanceInMeters": 8000,
            "estimatedDurationInSecs": 2700,
            "workoutSegments": [],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-15", "456")])

        assert entries[0]["distanceM"] == 8000
        assert entries[0]["durationSecs"] == 2700
