from garmin_step_fixtures import (
    detail_with_steps as _detail_with_steps,
    open_time_step as _open_time_step,
    pace_zone_step as _pace_zone_step,
    repeat_group as _repeat_group,
)
from processing.garmin_workout import (
    _quality_descriptor,
    build_workout_steps,
    collect_steps,
    estimate_from_steps,
    main_set_descriptor,
    resolve_adaptive_distance_duration,
    resolve_manual_distance_duration,
)


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

        total_dist, total_dur = estimate_from_steps(steps)

        interval_secs = 400 / (1000 / 225)  # distance / speed
        # Warm-up + 9x400m + 9x1' recovery + cool-down: none of it should be dropped.
        assert total_dur == 20 * 60 + 9 * interval_secs + 9 * 60 + 10 * 60
        assert total_dist > 9 * 400  # warm-up/cool-down/recovery jogging adds real km on top of the 9x400m

    def test_time_step_without_pace_target_uses_fallback_pace(self):
        steps = [_open_time_step("interval", 45 * 60)]

        total_dist, total_dur = estimate_from_steps(steps, fallback_pace_sec_per_km=375)

        assert total_dur == 45 * 60
        assert total_dist == (45 * 60) * (1000 / 375)

    def test_time_step_without_pace_target_and_no_fallback_contributes_zero_distance(self):
        steps = [_open_time_step("interval", 45 * 60)]

        total_dist, total_dur = estimate_from_steps(steps)

        assert total_dur == 45 * 60
        assert total_dist == 0

    def test_no_steps_returns_zero(self):
        assert estimate_from_steps([]) == (0.0, 0.0)


class TestResolveDistanceDuration:
    """The two strategies _build_entries picks between by is_adaptive - see
    their docstrings for why each trusts (or distrusts) Garmin's top-level
    estimatedDistanceInMeters/estimatedDurationInSecs."""

    def test_manual_sums_steps_over_garmins_incomplete_top_level_estimate(self):
        steps = [
            _pace_zone_step("warmup", "time", 20 * 60, 346, 375),
            _pace_zone_step("cooldown", "time", 10 * 60, 375, 375),
        ]
        detail = {"estimatedDistanceInMeters": 100, "estimatedDurationInSecs": 100}

        dist_m, dur_s = resolve_manual_distance_duration(detail, steps, easy_pace=375)

        assert dur_s == 30 * 60
        assert dist_m > 100

    def test_adaptive_trusts_the_top_level_estimate_over_the_step_sum(self):
        steps = [_pace_zone_step("interval", "time", 8 * 60, 247, 265)]
        detail = {"estimatedDistanceInMeters": 10003, "estimatedDurationInSecs": 2880}

        dist_m, dur_s = resolve_adaptive_distance_duration(detail, steps, easy_pace=375)

        assert (dist_m, dur_s) == (10003, 2880)

    def test_adaptive_fills_a_missing_field_from_the_step_sum(self):
        steps = [_pace_zone_step("warmup", "time", 10 * 60, 303, 343)]
        detail = {"estimatedDistanceInMeters": None, "estimatedDurationInSecs": 2880}

        dist_m, dur_s = resolve_adaptive_distance_duration(detail, steps, easy_pace=375)

        assert dur_s == 2880
        assert dist_m is not None and dist_m > 0


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

        steps = build_workout_steps(detail)

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

        steps = build_workout_steps(detail)

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

        steps = build_workout_steps(detail)

        assert steps[-1]["kind"] == "recovery"
        assert steps[-1]["rep"] == 3

    def test_single_continuous_block_is_still_returned(self):
        # A plain "Base" run with just a pace-zone goal (no warm-up/cool-down,
        # no repeats) is one lone ExecutableStepDTO - Garmin Connect itself
        # shows an estimated pace range for it, so RunOmics shouldn't drop it
        # either: the frontend renders a single effort step as "X' @ pace".
        detail = _detail_with_steps(
            _pace_zone_step("interval", "time", 85 * 60, 323, 343),
        )

        steps = build_workout_steps(detail)

        assert steps == [{"kind": "effort", "minutes": 85, "paceSecPerKm": [323, 343]}]

    def test_no_steps_at_all_returns_none(self):
        detail = _detail_with_steps()

        assert build_workout_steps(detail) is None


class TestCollectSteps:
    def test_expands_repeat_group_children_per_iteration(self):
        # Real Garmin/Kiprun interval workouts wrap the reps in a single
        # RepeatGroupDTO (type != "ExecutableStepDTO"), not a flat list - a
        # naive top-level filter drops the whole interval block.
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

        steps = collect_steps(detail)

        # 1 warmup + 9*(interval + rest) + 1 final rest = 20 raw steps.
        assert len(steps) == 20

    def test_flat_workout_with_no_repeat_group_is_unaffected(self):
        detail = _detail_with_steps(
            _pace_zone_step("warmup", "time", 20 * 60, 346, 375),
            _pace_zone_step("interval", "time", 20 * 60, 240, 240),
            _pace_zone_step("cooldown", "time", 10 * 60, 375, 375),
        )

        assert len(collect_steps(detail)) == 3


class TestMainSetDescriptor:
    def test_prefers_garmins_own_description_over_the_reconstructed_summary(self):
        # Garmin's description is authoritative for reps in seconds or metres,
        # which the step-derived summary can only render as whole minutes.
        detail = {"description": "10x400m@3:45/km"}

        assert main_set_descriptor(detail, "VMA", steps=None) == "10x400m@3:45/km"

    def test_ignores_a_description_the_name_already_spells_out(self):
        detail = {"description": "3x8:00"}

        assert main_set_descriptor(detail, "Seuil 3x8:00", steps=None) is None

    def test_falls_back_to_quality_descriptor_when_no_usable_description(self):
        steps = [
            {"kind": "effort", "minutes": 8, "rep": 1, "paceSecPerKm": [247, 265]},
            {"kind": "effort", "minutes": 8, "rep": 2, "paceSecPerKm": [247, 265]},
        ]

        assert main_set_descriptor({}, "Seuil", steps) == "2x8:00@4:16"


class TestQualityDescriptor:
    def test_no_descriptor_without_a_repeated_effort_step(self):
        # A single continuous effort block (no RepeatGroupDTO) has nothing to
        # summarize as "Nx...".
        steps = [
            {"kind": "warmup", "minutes": 10},
            {"kind": "effort", "minutes": 20, "paceSecPerKm": [240, 250]},
            {"kind": "cooldown", "minutes": 10},
        ]
        assert _quality_descriptor(steps) is None
