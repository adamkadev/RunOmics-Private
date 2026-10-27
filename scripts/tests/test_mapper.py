import json
from datetime import datetime

import pytest

from processing.activity_type import (
    PlannedRep,
    PlannedSession,
    TypeContext,
    TypeInference,
    infer_type,
    infer_type_with_source,
)
from processing.fit_parser import ActivitySplit, ParsedFit, SplitLap
from processing.type_context import load_type_context
from processing.mapper import (
    HrZone,
    _decimate_list,
    _parse_datetime,
    extract_gear_id,
    map_activity,
    parse_hr_zones,
)


class TestInferType:
    def test_race_flag_wins_over_everything(self):
        parsed = ParsedFit(is_race=True, primary_benefit=3)
        assert infer_type("Morning Run", parsed) == "Race"

    def test_primary_benefit_mapping(self):
        assert infer_type("", ParsedFit(primary_benefit=1)) == "Base"
        assert infer_type("", ParsedFit(primary_benefit=3)) == "Tempo"
        assert infer_type("", ParsedFit(primary_benefit=4)) == "Threshold"
        assert infer_type("", ParsedFit(primary_benefit=5)) == "VO2Max"
        assert infer_type("", ParsedFit(primary_benefit=7)) == "Sprint"

    def test_defaults_to_base(self):
        assert infer_type("Morning Run", None) == "Base"
        assert infer_type("", ParsedFit(primary_benefit=99)) == "Base"

    def test_garmin_primary_benefit_takes_precedence_over_local_evidence(self):
        parsed = ParsedFit(primary_benefit=3, splits=_intervals(30, 45, 6))

        assert infer_type_with_source("", parsed) == type_inference("Tempo", "garmin")

    def test_easy_run_is_base(self):
        result = infer_type_with_source(
            "",
            ParsedFit(duration_seconds=3_600),
            hr_zones=_zones(z1=35, z2=55, z3=8, z4=2),
        )

        assert result == type_inference("Base", "runomics")

    def test_sustained_tempo_pattern(self):
        result = infer_type_with_source(
            "",
            ParsedFit(duration_seconds=2_700),
            hr_zones=_zones(z1=10, z2=25, z3=50, z4=12, z5=3),
            context=TypeContext(lthr_bpm=179, z4_floor_bpm=170),
        )

        assert result == type_inference("Tempo", "runomics")

    def test_threshold_interval_pattern(self):
        result = infer_type_with_source(
            "", ParsedFit(splits=_intervals(600, 120, 3))
        )

        assert result == type_inference("Threshold", "runomics")

    def test_vo2_interval_pattern(self):
        result = infer_type_with_source(
            "", ParsedFit(splits=_intervals(240, 120, 5))
        )

        assert result == type_inference("VO2Max", "runomics")

    def test_short_hard_interval_pattern(self):
        result = infer_type_with_source(
            "", ParsedFit(splits=_intervals(90, 60, 6))
        )

        assert result == type_inference("Anaerobic", "runomics")

    def test_sprint_repetitions(self):
        result = infer_type_with_source(
            "", ParsedFit(splits=_intervals(30, 45, 8))
        )

        assert result == type_inference("Sprint", "runomics")

    def test_uncertain_partial_evidence_remains_base(self):
        result = infer_type_with_source(
            "", ParsedFit(duration_seconds=1_800, splits=_intervals(180, 30, 1))
        )

        assert result == type_inference("Base", "runomics")

    @pytest.mark.parametrize(
        ("segments", "planned_reps", "rep_seconds"),
        [
            ([(240, 2.05, 174, 5)], 5, 240),
            ([(180, 1.93, 161, 2), (5, 1.38, 169, 1), (9, 0.1, 169, 1), (180, 1.99, 170, 2)], 6, 180),
        ],
    )
    def test_walk_run_matching_the_planned_easy_session_takes_the_plan_type(self, segments, planned_reps, rep_seconds):
        splits = [split for segment in segments for split in _walk_run(*segment)]
        planned = (PlannedRep(seconds=rep_seconds),) * planned_reps
        context = TypeContext(sessions_by_date={"2026-10-25": (PlannedSession("Base", planned),)})

        result = infer_type_with_source("", ParsedFit(splits=splits), date="2026-10-25T09:12:00", context=context)

        assert result == type_inference("Base", "runomics")

    def test_planned_type_needs_the_runs_reps_to_match(self):
        context = TypeContext(sessions_by_date={"2026-10-25": (PlannedSession("Base", (PlannedRep(seconds=720),) * 2),)})

        result = infer_type_with_source("", ParsedFit(splits=_walk_run(240, 2.05, 174, 5)), date="2026-10-25", context=context)

        assert result == type_inference("VO2Max", "runomics")

    def test_slow_reps_without_an_lthr_stay_base_whatever_the_zones(self):
        result = infer_type_with_source(
            "",
            ParsedFit(duration_seconds=2_529, splits=_walk_run(505, 1.97, 177, 4)),
            hr_zones=_zones(z3=11, z4=71, z5=18),
            context=_beginner(),
        )

        assert result == type_inference("Base", "runomics")

    def test_fast_strides_stay_sprint_for_a_beginner(self):
        result = infer_type_with_source(
            "", ParsedFit(splits=_walk_run(20, 2.9, 170, 10, recovery_seconds=45)), context=_beginner()
        )

        assert result == type_inference("Sprint", "runomics")

    def test_slow_reps_at_threshold_heart_rate_count_when_the_lthr_is_known(self):
        context = TypeContext(threshold_speed_ms=3.83, lthr_bpm=179, z4_floor_bpm=170)

        result = infer_type_with_source("", ParsedFit(splits=_walk_run(240, 2.9, 176, 5)), context=context)

        assert result == type_inference("VO2Max", "runomics")

    def test_load_type_context_reads_threshold_from_vma_and_newest_plan_per_week(self, tmp_path):
        coaching = tmp_path / "coaching"
        (coaching / "superseded").mkdir(parents=True)
        (tmp_path / "athlete.json").write_text(json.dumps({"vmaKmh": 10.8, "hrZoneBoundsBpm": [103, 124, 144, 165, 185]}))
        (coaching / "current_plan.json").write_text(json.dumps(_plan("2026-10-20", "easy", "2026-10-21", 6, 180)))
        (coaching / "superseded" / "old.json").write_text(json.dumps(
            {**_plan("2026-10-13", "vo2max", "2026-10-21", 5, 240), "weeks": [
                _plan("2026-10-13", "vo2max", "2026-10-14", 5, 240)["weeks"][0],
                _plan("2026-10-20", "vo2max", "2026-10-21", 5, 240)["weeks"][0],
            ]}
        ))

        context = load_type_context(tmp_path)

        assert context.threshold_speed_ms == pytest.approx(2.55)
        assert (context.lthr_bpm, context.z4_floor_bpm) == (None, None)
        assert context.sessions_by_date == {
            "2026-10-21": (PlannedSession("Base", (PlannedRep(seconds=180),) * 6),),
            "2026-10-14": (PlannedSession("VO2Max", (PlannedRep(seconds=240),) * 5),),
        }

    def test_slow_reps_at_threshold_heart_rate_stay_base_when_the_heart_rate_is_untrusted(self):
        context = TypeContext(threshold_speed_ms=3.83, lthr_bpm=179, z4_floor_bpm=170, hr_reliable_from="2026-10-16")
        parsed = ParsedFit(splits=_walk_run(240, 2.9, 176, 5), hr_source="external")

        before = infer_type_with_source("", parsed, date="2026-10-10", context=context)
        after = infer_type_with_source("", parsed, date="2026-10-20", context=context)

        assert (before, after) == (type_inference("Base", "runomics"), type_inference("VO2Max", "runomics"))

    def test_zones_of_a_run_marked_hr_unreliable_do_not_type_it(self):
        context = TypeContext(lthr_bpm=179, hr_unreliable_ids=frozenset({"7"}))
        parsed = ParsedFit(duration_seconds=2_400, aer_training_effect=None)

        marked = infer_type_with_source("", parsed, activity_id="7", hr_zones=_zones(z5=30), context=context)
        unmarked = infer_type_with_source("", parsed, activity_id="8", hr_zones=_zones(z5=30), context=context)

        assert (marked.activity_type, unmarked.activity_type) == ("Base", "VO2Max")

    def test_a_wrist_run_after_the_reliable_date_is_untrusted(self):
        context = TypeContext(hr_reliable_from="2026-10-16")

        assert context.hr_trusted("1", "2026-10-20", "external")
        assert not context.hr_trusted("1", "2026-10-20", "wrist")
        assert not context.hr_trusted("1", "2026-10-15", "external")
        assert TypeContext().hr_trusted("1", "2026-10-15", "wrist")

    def test_load_type_context_reads_the_reliable_date_and_the_marked_runs(self, tmp_path):
        (tmp_path / "athlete.json").write_text(json.dumps({"hrReliableFrom": "2026-10-16"}))
        (tmp_path / "activity_notes.json").write_text(json.dumps({"notes": {
            "1": {"note": "", "tags": [], "hrUnreliable": True},
            "2": {"note": "easy", "tags": []},
            "3": {"note": "", "tags": [], "hrUnreliable": "yes"},
        }}))

        context = load_type_context(tmp_path)

        assert (context.hr_reliable_from, context.hr_unreliable_ids) == ("2026-10-16", frozenset({"1"}))

    def test_race_remains_highest_priority_and_reports_garmin_source(self):
        parsed = ParsedFit(is_race=True, primary_benefit=1, splits=_intervals(30, 45, 8))

        assert infer_type_with_source("", parsed) == type_inference("Race", "garmin")


class TestParseHrZones:
    def test_percentages_and_boundaries(self):
        zones = parse_hr_zones([
            {"zoneNumber": 2, "secsInZone": 300, "zoneLowBoundary": 120, "zoneHighBoundary": 145},
            {"zoneNumber": 1, "secsInZone": 700, "zoneLowBoundary": 0, "zoneHighBoundary": 120},
        ])

        assert [z.zone for z in zones] == [1, 2]
        assert zones[0].percent == 70.0
        assert zones[1].percent == 30.0
        assert zones[1].max_bpm == 145

    def test_zero_total_time_returns_empty(self):
        assert parse_hr_zones([{"zoneNumber": 1, "secsInZone": 0}]) == []

    def test_empty_input(self):
        assert parse_hr_zones([]) == []


class TestExtractGearId:
    def test_first_uuid(self):
        assert extract_gear_id([{"uuid": "shoe-1"}, {"uuid": "shoe-2"}]) == "shoe-1"

    def test_none_or_empty(self):
        assert extract_gear_id(None) is None
        assert extract_gear_id([]) is None


class TestMapActivity:
    def _garmin_activity(self):
        return {
            "activityId": 12345,
            "activityName": "Fictionville - Morning Run",
            "summaryDTO": {
                "startTimeLocal": "2026-07-01 08:30:00",
                "duration": 1800.0,
                "distance": 6000.0,
                "averageHR": 152,
            },
        }

    def test_api_only_mapping_without_fit(self):
        data = map_activity(self._garmin_activity(), None)

        assert data.id == "12345"
        assert data.description == "Morning Run"
        assert data.date == "2026-07-01"
        assert data.day_of_week == "Wednesday"
        assert data.week == 202627
        assert data.duration_seconds == 1800
        assert data.distance_km == 6.0
        assert data.pace_sec_per_km == 300.0
        assert data.avg_heart_rate == 152
        assert data.type == "Base"
        assert data.type_source == "runomics"
        assert data.to_dict()["typeSource"] == "runomics"
        assert data.route is None

    def test_fit_values_take_priority_over_api(self):
        parsed = ParsedFit(
            duration_seconds=1750,
            distance_m=5950.0,
            avg_heart_rate=149,
            start_time_local=datetime(2026, 7, 2, 7, 0, 0),
            elevation_gain_m=42.5,
            rpe=7,
        )
        data = map_activity(self._garmin_activity(), parsed)

        assert data.duration_seconds == 1750
        assert data.distance_km == 5.95
        assert data.avg_heart_rate == 149
        assert data.date == "2026-07-02"
        assert data.elevation_gain == 42.5
        assert data.rpe == 7

    def test_local_type_inference_does_not_fabricate_training_effect(self):
        parsed = ParsedFit(
            duration_seconds=2_400,
            distance_m=8_000,
            splits=_intervals(240, 120, 5),
        )

        data = map_activity(self._garmin_activity(), parsed)

        assert data.type == "VO2Max"
        assert data.type_source == "runomics"
        assert data.aer_training_effect is None
        assert data.ana_training_effect is None

    def test_api_rpe_is_rescaled_from_percent(self):
        activity = self._garmin_activity()
        activity["directWorkoutRpe"] = 70
        data = map_activity(activity, None)
        assert data.rpe == 7

    def test_weather_is_passed_through_to_the_json(self):
        weather = {"tempC": 19.0, "humidityPct": 69, "code": 0}
        data = map_activity(self._garmin_activity(), None, weather=weather)

        assert data.weather == weather
        assert data.to_dict()["weather"] == weather

    def test_weather_defaults_to_none(self):
        assert map_activity(self._garmin_activity(), None).to_dict()["weather"] is None

    def test_lap_splits_are_persisted_rather_than_null(self):
        parsed = ParsedFit(
            duration_seconds=1_800,
            distance_m=6_000.0,
            splits=_laps(300, 1000.0, 6),
        )

        data = map_activity(self._garmin_activity(), parsed)

        assert data.splits is not None
        assert len(data.splits) == 6
        assert data.to_dict()["splits"][0] == {
            "type": "lap",
            "durationSec": 300,
            "distanceM": 1000.0,
            "avgSpeedMs": 3.3333,
            "avgHr": 150,
            "laps": [],
        }

    def test_hr_source_and_longest_continuous_run_are_stored(self):
        parsed = ParsedFit(
            duration_seconds=1_800, distance_m=4_000.0, hr_source="wrist",
            longest_continuous_run_sec=600, longest_continuous_run_m=1_420.5,
        )

        data = map_activity(self._garmin_activity(), parsed).to_dict()

        assert (data["hrSource"], data["longestContinuousRunSec"], data["longestContinuousRunM"]) == ("wrist", 600, 1_420.5)

    def test_no_splits_still_serialises_as_null(self):
        data = map_activity(self._garmin_activity(), ParsedFit(duration_seconds=1_800))

        assert data.to_dict()["splits"] is None

    def test_long_sample_arrays_are_decimated_for_charts(self):
        parsed = ParsedFit(
            duration_seconds=1800,
            distance_m=6000.0,
            heart_rates=list(range(1000)),
        )
        data = map_activity(self._garmin_activity(), parsed)
        assert data.hr_samples is not None
        assert len(data.hr_samples) == 150


class TestDecimateList:
    def test_short_lists_untouched(self):
        assert _decimate_list([1, 2, 3], 150) == [1, 2, 3]

    def test_keeps_endpoints_and_length(self):
        items = list(range(1000))
        out = _decimate_list(items, 150)
        assert len(out) == 150
        assert out[0] == 0
        assert out[-1] == 999


class TestParseDatetime:
    def test_supported_formats(self):
        assert _parse_datetime("2026-07-01 08:30:00") == datetime(2026, 7, 1, 8, 30)
        assert _parse_datetime("2026-07-01T08:30:00") == datetime(2026, 7, 1, 8, 30)
        assert _parse_datetime("2026-07-01T08:30:00.500") == datetime(2026, 7, 1, 8, 30, 0, 500000)

    def test_an_unparseable_value_raises_rather_than_dating_it_1970(self):
        with pytest.raises(ValueError, match="'not a date'"):
            _parse_datetime("not a date")

    def test_an_activity_without_a_readable_start_time_is_refused(self):
        with pytest.raises(ValueError):
            map_activity({"activityId": 1, "summaryDTO": {"duration": 1800.0}}, None)


def type_inference(activity_type, source):
    return TypeInference(activity_type, source)


def _intervals(effort_seconds, recovery_seconds, repetitions):
    laps = [SplitLap(effort_seconds, 400.0, 4.0, 170) for _ in range(repetitions)]
    return [
        ActivitySplit(
            "interval_active",
            effort_seconds * repetitions,
            400.0 * repetitions,
            4.0,
            170,
            laps,
        ),
        ActivitySplit(
            "interval_recovery",
            recovery_seconds * repetitions,
            100.0 * repetitions,
            2.0,
            130,
        ),
    ]


def _walk_run(effort_seconds, speed_ms, heart_rate, repetitions, *, recovery_seconds=60):
    splits = []
    for _ in range(repetitions):
        splits.append(ActivitySplit("interval_active", effort_seconds, effort_seconds * speed_ms, speed_ms, heart_rate))
        splits.append(ActivitySplit("interval_recovery", recovery_seconds, recovery_seconds * 1.2, 1.2, heart_rate - 10))
    return splits


def _beginner():
    return TypeContext(threshold_speed_ms=2.57)


def _plan(week_start, coaching_type, date, reps, rep_seconds):
    effort = {"kind": "effort", "target": {"durationSeconds": rep_seconds}}
    workout = {
        "date": date,
        "type": coaching_type,
        "status": "prescribed",
        "blocks": [
            {"kind": "warmup", "target": {"distanceMeters": 400}},
            {"kind": "repeat", "repetitions": reps, "steps": [effort, {"kind": "recovery", "target": {"durationSeconds": 60}}]},
        ],
    }
    return {"provenance": {"createdAt": f"{week_start}T00:00:00Z"}, "weeks": [
        {"startDate": week_start, "endDate": week_start[:8] + f"{int(week_start[8:]) + 6:02d}", "workouts": [workout]},
    ]}


def _laps(duration_seconds, distance_m, count):
    return [
        ActivitySplit("lap", duration_seconds, distance_m, distance_m / duration_seconds, 150)
        for _ in range(count)
    ]


def _zones(**shares):
    return [
        HrZone(
            zone=int(key[1:]),
            seconds=round(percent * 36),
            percent=float(percent),
            min_bpm=100 + int(key[1:]) * 10,
            max_bpm=None,
        )
        for key, percent in shares.items()
    ]


def test_preserves_non_running_sport_for_running_volume_filters():
    activity = map_activity(
        {"activityId": 1, "startTimeLocal": "2026-09-05 10:00:00", "activityType": {"typeKey": "cycling"}}, None
    )
    assert activity.to_dict()["sport"] == "cycling"
