import json
from datetime import date, timedelta

from garmin.client import GarminAPIError
from garmin_step_fixtures import (
    open_time_step as _open_time_step,
    pace_zone_step as _pace_zone_step,
    repeat_group as _repeat_group,
)
from processing.mapper import ActivityData
from processing.planned_workout_type import infer_planned_type
from repository.json_store import PlannedWorkoutStore
from sync_workouts import (
    _DEFAULT_EASY_PACE_SEC_PER_KM,
    _WINDOW_FUTURE_DAYS,
    _WINDOW_PAST_DAYS,
    _build_entries,
    _load_coach_named_workouts,
    _load_coach_workout_types,
    _load_easy_pace_sec_per_km,
    enrich_description_from_plan,
    fetch_planned_workouts,
    prefer_planned_name,
    write_planned_workouts,
)


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

    def test_says_so_when_it_falls_back_over_an_unreadable_file(self, tmp_path, capsys):
        (tmp_path / "athlete.json").write_text('{"thresholdPaceSecPerKm": 25')

        assert _load_easy_pace_sec_per_km(tmp_path) == _DEFAULT_EASY_PACE_SEC_PER_KM
        assert f"{tmp_path / 'athlete.json'} could not be read" in capsys.readouterr().out


class TestContinuousBaseWorkoutGetsTheSameFields:
    def test_distance_duration_and_pace_are_all_populated(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Footing",
            "sportType": {"sportTypeKey": "running"},
            "workoutSegments": [
                {"workoutSteps": [_pace_zone_step("interval", "time", 85 * 60, 303, 343)]}
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-21", "555", "", False)])

        entry = entries[0]
        assert entry["durationSecs"] == 85 * 60
        assert entry["distanceM"] > 0
        assert entry["steps"] == [
            {"kind": "effort", "minutes": 85, "paceSecPerKm": [303, 343]}
        ]


class _FakeClient:
    def __init__(self, detail: dict):
        self._detail = detail
        self.calls: list[tuple[str, str]] = []

    def get_workout_detail(self, workout_id):
        self.calls.append(("workout", workout_id))
        return self._detail

    def get_adaptive_workout_detail(self, workout_uuid):
        self.calls.append(("fbt-adaptive", workout_uuid))
        return self._detail


class _CalendarRecordingClient:
    def __init__(self):
        self.months: list[tuple[int, int]] = []

    def get_calendar_month(self, year, month):
        self.months.append((year, month))
        return {"calendarItems": []}


class TestFetchWindow:
    def test_defaults_to_the_rolling_window(self):
        client = _CalendarRecordingClient()

        fetch_planned_workouts(client)

        today = date.today()
        expected_first = (today - timedelta(days=_WINDOW_PAST_DAYS)).replace(day=1)
        expected_last = today + timedelta(days=_WINDOW_FUTURE_DAYS)
        assert client.months[0] == (expected_first.year, expected_first.month)
        assert client.months[-1] == (expected_last.year, expected_last.month)

    def test_an_explicit_range_widens_the_window(self):
        # The store keeps every date it's given, so a historical backfill is just a wider fetch.
        client = _CalendarRecordingClient()

        fetch_planned_workouts(
            client, since=date(2025, 5, 1), until=date(2025, 8, 15)
        )

        assert client.months == [(2025, 5), (2025, 6), (2025, 7), (2025, 8)]

    def test_each_bound_can_be_set_on_its_own(self):
        client = _CalendarRecordingClient()

        fetch_planned_workouts(client, since=date(2025, 11, 1), until=date(2026, 1, 3))

        assert client.months == [(2025, 11), (2025, 12), (2026, 1)]


class TestBuildEntriesPrefersStepSum:
    def test_ignores_garmins_incomplete_top_level_estimate(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        # A real RepeatGroupDTO, not a flattened list: Garmin's own top-level estimate covers only the warm-up and
        # cool-down here, as a repeat-group-blind step collector would.
        detail = {
            "workoutName": "9 x 400m (R=1 min)",
            "sportType": {"sportTypeKey": "running"},
            "estimatedDistanceInMeters": 4933,
            "estimatedDurationInSecs": 1800,
            "workoutSegments": [
                {
                    "workoutSteps": [
                        _pace_zone_step("warmup", "time", 20 * 60, 346, 375),
                        _repeat_group(
                            9,
                            [
                                _pace_zone_step("interval", "distance", 400, 225, 225),
                                _pace_zone_step("rest", "time", 60, 375, 375),
                            ],
                        ),
                        _pace_zone_step("rest", "time", 10 * 60, 375, 375),
                    ]
                }
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-14", "123", "", False)])

        assert len(entries) == 1
        entry = entries[0]
        # Garmin's top-level estimate is 30 min / 4.9 km.
        assert entry["durationSecs"] > 1800
        assert entry["distanceM"] > 4933
        # Its own row, not folded into "recovery", which would inflate the main interval row's minutes.
        assert entry["steps"][-1]["kind"] == "cooldown"

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

        entries = _build_entries(client, [("2026-07-15", "456", "", False)])

        assert entries[0]["distanceM"] == 8000
        assert entries[0]["durationSecs"] == 2700

    def test_estimates_missing_duration_for_open_distance_goal_run(self, monkeypatch):
        # "8km endurance": Garmin gave a distance goal but no duration, and
        # there's no structured step breakdown to estimate from either.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        monkeypatch.setattr("sync_workouts._load_easy_pace_sec_per_km", lambda: 375)
        detail = {
            "workoutName": "8km endurance",
            "sportType": {"sportTypeKey": "running"},
            "estimatedDistanceInMeters": 8000,
            "estimatedDurationInSecs": None,
            "workoutSegments": [],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-19", "789", "", False)])

        assert entries[0]["distanceM"] == 8000
        assert entries[0]["durationSecs"] == round(8 * 375)

    def test_estimates_missing_distance_for_open_time_goal_run(self, monkeypatch):
        # "1h endurance": Garmin gave a duration goal but no distance.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        monkeypatch.setattr("sync_workouts._load_easy_pace_sec_per_km", lambda: 375)
        detail = {
            "workoutName": "1 h endurance",
            "sportType": {"sportTypeKey": "running"},
            "estimatedDistanceInMeters": None,
            "estimatedDurationInSecs": 3600,
            "workoutSegments": [],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-09", "321", "", False)])

        assert entries[0]["durationSecs"] == 3600
        assert entries[0]["distanceM"] == round(3600 * 1000 / 375)


class TestAdaptiveWorkoutFallback:
    """Garmin Coach's fbtAdaptiveWorkout calendar items have no workoutId, only
    a workoutUuid, which workout-service/workout/{id} doesn't recognize - their
    detail comes from workout-service/fbt-adaptive/{uuid} instead."""

    def test_adaptive_items_are_resolved_through_the_fbt_adaptive_endpoint(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        client = _FakeClient({"workoutName": "Seuil", "workoutSegments": []})

        _build_entries(
            client,
            [
                ("2026-07-21", "744f8b60-38dc-4665-b641-1221027c26ce", "Seuil", True),
                ("2026-07-22", "123", "Footing", False),
            ],
        )

        assert client.calls == [
            ("fbt-adaptive", "744f8b60-38dc-4665-b641-1221027c26ce"),
            ("workout", "123"),
        ]

    def test_falls_back_to_calendar_title_when_detail_fetch_fails(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)

        class _FailingClient:
            def get_adaptive_workout_detail(self, workout_uuid):
                raise GarminAPIError(404, f"fbt-adaptive/{workout_uuid}")

        entries = _build_entries(
            _FailingClient(), [("2026-07-21", "744f8b60-38dc-4665-b641-1221027c26ce", "Seuil", True)]
        )

        assert entries == [{"date": "2026-07-21", "name": "Seuil"}]

    def test_reports_the_date_even_without_a_fallback_title(self, monkeypatch):
        # A dropped date looks free, and the stale-entry pruning would delete the entry on file for it.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)

        class _FailingClient:
            def get_workout_detail(self, workout_id):
                raise GarminAPIError(404, f"workout/{workout_id}")

        entries = _build_entries(_FailingClient(), [("2026-07-21", "999", "", False)])

        assert entries == [{"date": "2026-07-21", "name": ""}]

    def test_a_transient_detail_failure_is_retried(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        calls = []

        class _FlakyClient:
            def get_workout_detail(self, workout_id):
                calls.append(workout_id)
                if len(calls) == 1:
                    raise GarminAPIError(503, f"workout/{workout_id}")
                return {
                    "workoutName": "Easy run",
                    "sportType": {"sportTypeKey": "running"},
                    "estimatedDurationInSecs": 2700,
                    "workoutSegments": [],
                }

        entries = _build_entries(_FlakyClient(), [("2026-07-21", "456", "Easy run", False)])

        assert calls == ["456", "456"]
        assert entries[0]["durationSecs"] == 2700

    def test_uses_adaptive_detail_when_it_succeeds(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Seuil",
            "sportType": {"sportTypeKey": "running"},
            "estimatedDistanceInMeters": 8000,
            "estimatedDurationInSecs": 2880,
            "workoutSegments": [],
        }
        client = _FakeClient(detail)

        entries = _build_entries(
            client, [("2026-07-21", "744f8b60-38dc-4665-b641-1221027c26ce", "Seuil", True)]
        )

        assert entries[0]["distanceM"] == 8000
        assert entries[0]["durationSecs"] == 2880

    def test_trusts_the_top_level_estimate_over_the_step_sum(self, monkeypatch):
        # Garmin Coach's own numbers are first-party, unlike third-party plans'.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Seuil",
            "sportType": {"sportTypeKey": "running"},
            "estimatedDistanceInMeters": 10003,
            "estimatedDurationInSecs": 2880,
            "workoutSegments": [
                {
                    "workoutSteps": [
                        _pace_zone_step("warmup", "time", 10 * 60, 303, 343),
                        _repeat_group(
                            3, [_pace_zone_step("interval", "time", 8 * 60, 247, 265)]
                        ),
                        _pace_zone_step("cooldown", "time", 10 * 60, 303, 343),
                    ]
                }
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(
            client, [("2026-07-21", "744f8b60-38dc-4665-b641-1221027c26ce", "", True)]
        )

        assert entries[0]["distanceM"] == 10003
        assert entries[0]["durationSecs"] == 2880

    def test_fills_a_missing_top_level_field_from_the_step_sum(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Seuil",
            "sportType": {"sportTypeKey": "running"},
            "estimatedDistanceInMeters": None,
            "estimatedDurationInSecs": 2880,
            "workoutSegments": [
                {
                    "workoutSteps": [
                        _pace_zone_step("warmup", "time", 10 * 60, 303, 343),
                        _pace_zone_step("cooldown", "time", 10 * 60, 303, 343),
                    ]
                }
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(
            client, [("2026-07-21", "744f8b60-38dc-4665-b641-1221027c26ce", "", True)]
        )

        assert entries[0]["durationSecs"] == 2880
        assert entries[0]["distanceM"] > 0


class TestCoachingPlanTypes:
    """A workout the coaching plan pushed to Garmin is typed by the plan, not guessed from its free-text title."""

    @staticmethod
    def _coaching_dir(tmp_path):
        coaching = tmp_path / "coaching"
        (coaching / "superseded").mkdir(parents=True)
        (coaching / "garmin-sync.json").write_text(json.dumps({"entries": [
            {"prescriptionId": "plan-2:workout:1:1", "date": "2026-09-23", "garminWorkoutId": "1688054933"},
            {"prescriptionId": "plan-1:workout:1:2", "date": "2026-09-17", "garminWorkoutId": "1688054900"},
            {"prescriptionId": "plan-0:workout:1:1", "date": "2026-09-06", "garminWorkoutId": "1688054800"},
        ]}))
        def plan(workout_id, workout_type):
            return json.dumps({"weeks": [{"workouts": [{"id": workout_id, "type": workout_type}]}]})

        (coaching / "current_plan.json").write_text(plan("plan-2:workout:1:1", "threshold"))
        (coaching / "superseded" / "plan-1.json").write_text(plan("plan-1:workout:1:2", "long_run"))
        return tmp_path

    def test_maps_each_pushed_workout_to_its_plan_type(self, tmp_path):
        types = _load_coach_workout_types(self._coaching_dir(tmp_path))
        # plan-0 is kept nowhere any more: that workout falls back to its name.
        assert types == {"1688054933": "Threshold", "1688054900": "Base"}

    def test_is_empty_without_a_coaching_plan_or_when_it_cannot_be_read(self, tmp_path):
        assert _load_coach_workout_types(tmp_path) == {}
        (tmp_path / "coaching").mkdir()
        (tmp_path / "coaching" / "garmin-sync.json").write_text("{not json")
        assert _load_coach_workout_types(tmp_path) == {}

    def test_types_a_pushed_workout_by_the_plan_whatever_its_title(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        monkeypatch.setattr("sync_workouts._load_coach_workout_types", lambda: {"1688054933": "Threshold"})
        detail = {"workoutName": "Session du jour", "sportType": {"sportTypeKey": "running"}, "workoutSegments": []}

        entries = _build_entries(_FakeClient(detail), [("2026-09-23", "1688054933", "", False)])

        assert entries[0]["type"] == "Threshold"

    def test_no_title_overrides_the_plan(self, tmp_path):
        # The plan called it a long run; the title mentions tempo.
        write_planned_workouts(
            [{"date": "2026-09-27", "name": "Long run with a tempo finish", "type": "Base"}],
            store=PlannedWorkoutStore(tmp_path),
        )

        assert json.loads((tmp_path / "2026.json").read_text())["planned"][0]["type"] == "Base"


class TestCoachNamedWorkouts:
    """A name the coach wrote under the naming rules is kept as written, never cut at " + " nor given a descriptor."""

    @staticmethod
    def _coaching_dir(tmp_path):
        coaching = tmp_path / "coaching"
        coaching.mkdir(parents=True)
        (coaching / "garmin-sync.json").write_text(json.dumps({"entries": [
            {"prescriptionId": "plan-3:workout:1:1", "date": "2026-10-27", "garminWorkoutId": "1700000001"},
            {"prescriptionId": "plan-3:workout:1:2", "date": "2026-10-28", "garminWorkoutId": "1700000002"},
        ]}))
        (coaching / "current_plan.json").write_text(json.dumps({"weeks": [{"workouts": [
            {
                "id": "plan-3:workout:1:1",
                "type": "threshold",
                "title": "Threshold · 3 × 8′ @ 4:25",
                "shortName": "Threshold 3×8′",
            },
            {"id": "plan-3:workout:1:2", "type": "threshold", "title": "Threshold 3 x 7:40"},
        ]}]}))
        return tmp_path

    @staticmethod
    def _threshold(name: str) -> dict:
        return {
            "workoutName": name,
            "sportType": {"sportTypeKey": "running"},
            "workoutSegments": [
                {
                    "workoutSteps": [
                        _pace_zone_step("warmup", "distance", 2000, 330, 384),
                        _repeat_group(
                            3,
                            [
                                _pace_zone_step("interval", "time", 460, 262, 268),
                                _pace_zone_step("recovery", "time", 240, 360, 420),
                            ],
                        ),
                        _pace_zone_step("cooldown", "distance", 1600, 330, 384),
                    ]
                }
            ],
        }

    def test_finds_the_sessions_named_under_the_rules(self, tmp_path):
        assert _load_coach_named_workouts(self._coaching_dir(tmp_path)) == {"1700000001"}

    def test_is_empty_without_a_coaching_plan_or_when_it_cannot_be_read(self, tmp_path):
        assert _load_coach_named_workouts(tmp_path) == set()
        (tmp_path / "coaching").mkdir()
        (tmp_path / "coaching" / "garmin-sync.json").write_text("{not json")
        assert _load_coach_named_workouts(tmp_path) == set()

    def test_keeps_a_coach_named_session_as_written(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        monkeypatch.setattr("sync_workouts._load_coach_workout_types", lambda: {"1700000001": "Threshold"})
        monkeypatch.setattr("sync_workouts._load_coach_named_workouts", lambda: {"1700000001"})

        client = _FakeClient(self._threshold("Threshold · 3 × 8′ @ 4:25"))
        entries = _build_entries(client, [("2026-10-27", "1700000001", "", False)])

        assert entries[0]["name"] == "Threshold · 3 × 8′ @ 4:25"
        assert entries[0]["type"] == "Threshold"

    def test_keeps_the_strides_a_coach_name_carries(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        monkeypatch.setattr("sync_workouts._load_coach_workout_types", lambda: {"1700000003": "Base"})
        monkeypatch.setattr("sync_workouts._load_coach_named_workouts", lambda: {"1700000003"})
        detail = {
            "workoutName": "Easy · 54 min + 6 strides",
            "sportType": {"sportTypeKey": "running"},
            "workoutSegments": [{"workoutSteps": [_pace_zone_step("interval", "distance", 9000, 330, 384)]}],
        }

        entries = _build_entries(_FakeClient(detail), [("2026-10-29", "1700000003", "", False)])

        assert entries[0]["name"] == "Easy · 54 min + 6 strides"

    def test_an_older_coach_name_still_gains_its_main_set(self, monkeypatch):
        # Past plans keep their names: "Threshold 3 x 7:40" reads as it did.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        monkeypatch.setattr("sync_workouts._load_coach_workout_types", lambda: {"1700000002": "Threshold"})
        monkeypatch.setattr("sync_workouts._load_coach_named_workouts", lambda: set())

        entries = _build_entries(_FakeClient(self._threshold("Threshold 3 x 7:40")), [("2026-10-28", "1700000002", "", False)])

        assert entries[0]["name"] == "Threshold 3 x 7:40 - 3x8'@4:25"


class TestGarminSuppliedMetadata:
    """Third-party plans (Kiprun) carry no training-effect target nor structure description, so they use the name."""

    def test_training_effect_label_sets_the_type(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Cadence",
            "sportType": {"sportTypeKey": "running"},
            "trainingEffectLabel": "VO2MAX",
            "workoutSegments": [],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-23", "abc", "", True)])

        # Name-based inference would have said "Base" for "Cadence".
        assert entries[0]["type"] == "VO2Max"

    def test_workout_phrase_is_not_used_as_a_type(self, monkeypatch):
        # workoutPhrase is a coaching taxonomy on a different axis; only trainingEffectLabel maps onto ActivityType.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Longue course",
            "sportType": {"sportTypeKey": "running"},
            "trainingEffectLabel": "AEROBIC_BASE",
            "workoutPhrase": "LONG_WORKOUT",
            "workoutSegments": [],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-26", "abc", "", True)])

        assert entries[0]["type"] == "Base"

    def test_speed_label_maps_to_sprint(self, monkeypatch):
        # Garmin labels short-rep neuromuscular sessions SPEED, not SPRINT.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Sprint",
            "sportType": {"sportTypeKey": "running"},
            "trainingEffectLabel": "SPEED",
            "workoutPhrase": "ANAEROBIC_SPEED",
            "description": "3x3x0:15@2:45/km",
            "workoutSegments": [],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-23", "abc", "", True)])

        assert entries[0]["type"] == "Sprint"
        assert entries[0]["name"] == '3x3x15"@2:45'

    def test_skips_rest_days(self, monkeypatch):
        # Garmin Coach schedules rest days as calendar items like any other
        # session: no name, no sport, trainingEffectLabel "INVALID".
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": None,
            "sportType": None,
            "trainingEffectLabel": "INVALID",
            "workoutPhrase": "FORCED_REST",
            "restDay": True,
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-24", "abc", "Repos", True)])

        assert entries == []

    def test_garmin_type_wins_over_a_preserved_prior_type(self, tmp_path):
        prior = PlannedWorkoutStore(tmp_path)
        prior.upsert({"date": "2026-07-21", "name": "Seuil", "type": "Base"})
        prior.save()

        write_planned_workouts(
            [{"date": "2026-07-21", "name": "Seuil", "type": "Threshold"}],
            store=PlannedWorkoutStore(tmp_path),
        )

        written = json.loads((tmp_path / "2026.json").read_text())
        assert written["planned"][0]["type"] == "Threshold"

    def test_prefers_garmins_own_description_over_the_reconstructed_summary(self, monkeypatch):
        # Garmin's description is authoritative for reps in seconds or metres,
        # which the step-derived summary can only render as whole minutes.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "VMA",
            "sportType": {"sportTypeKey": "running"},
            "workoutPhrase": "VO2MAX",
            "description": "10x400m@3:45/km",
            "workoutSegments": [],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-24", "def", "", True)])

        assert entries[0]["name"] == "10x400m@3:45"

    def test_ignores_a_description_the_name_already_spells_out(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Seuil 3x8:00",
            "sportType": {"sportTypeKey": "running"},
            "description": "3x8:00",
            "workoutSegments": [],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-25", "ghi", "", True)])

        assert entries[0]["name"] == "Seuil 3x8:00"

    def test_ignores_prose_description_from_a_third_party_plan(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Seuil",
            "sportType": {"sportTypeKey": "running"},
            "description": (
                "Cette seance de seuil vise a ameliorer votre capacite a tenir "
                "une allure soutenue sur la duree."
            ),
            "workoutSegments": [
                {
                    "workoutSteps": [
                        _pace_zone_step("warmup", "time", 10 * 60, 303, 343),
                        _repeat_group(
                            3, [_pace_zone_step("interval", "time", 8 * 60, 247, 265)]
                        ),
                        _pace_zone_step("cooldown", "time", 10 * 60, 303, 343),
                    ]
                }
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-26", "jkl", "", False)])

        assert entries[0]["name"] == "3x8'@4:16"


class TestMainSetDescriptorInTitle:
    """The descriptor itself is covered in test_garmin_workout.py; these test when _build_entries puts it in the title."""

    def test_replaces_a_coach_type_word_name_with_the_interval_block(self, monkeypatch):
        # Garmin Coach names a session after its type ("Seuil"), which the UI
        # already shows as a badge - so the structure takes the title over.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Seuil",
            "sportType": {"sportTypeKey": "running"},
            "workoutSegments": [
                {
                    "workoutSteps": [
                        _pace_zone_step("warmup", "time", 10 * 60, 303, 343),
                        _repeat_group(
                            3,
                            [
                                _pace_zone_step("interval", "time", 8 * 60, 247, 265),
                                _pace_zone_step("recovery", "time", 2 * 60, 343, 429),
                            ],
                        ),
                        _pace_zone_step("cooldown", "time", 10 * 60, 303, 343),
                    ]
                }
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-21", "999", "", False)])

        assert entries[0]["name"] == "3x8'@4:16"

    def test_no_descriptor_for_base_session_even_with_repeats(self, monkeypatch):
        # Only sessions infer_planned_type classifies as quality get the interval summary.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Footing fractionne",
            "sportType": {"sportTypeKey": "running"},
            "workoutSegments": [
                {
                    "workoutSteps": [
                        _repeat_group(
                            2,
                            [
                                _open_time_step("other", 5 * 60),
                                _open_time_step("recovery", 60),
                            ],
                        ),
                    ]
                }
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-22", "111", "", False)])

        assert entries[0]["name"] == "Footing fractionne"

    def test_base_keeps_the_bare_type_word_even_with_a_target_pace(self, monkeypatch):
        # An easy run has no structure worth surfacing - the type badge alone
        # is enough, whether or not Garmin attached a target pace to it.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Base",
            "sportType": {"sportTypeKey": "running"},
            "trainingEffectLabel": "BASE",
            "workoutSegments": [
                {"workoutSteps": [_pace_zone_step("interval", "time", 31 * 60, 308, 346)]}
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-28", "222", "", True)])

        assert entries[0]["name"] == "Base"

    def test_base_keeps_the_bare_type_word_without_a_target_pace(self, monkeypatch):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Base",
            "sportType": {"sportTypeKey": "running"},
            "trainingEffectLabel": "BASE",
            "workoutSegments": [{"workoutSteps": [_open_time_step("interval", 31 * 60)]}],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-29", "333", "", True)])

        assert entries[0]["name"] == "Base"

    def test_keeps_the_type_a_coach_name_stated_before_dropping_the_word(self, monkeypatch):
        # No trainingEffectLabel here, so once "Seuil" leaves the name nothing
        # else could tell this apart from an easy run.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        detail = {
            "workoutName": "Seuil",
            "sportType": {"sportTypeKey": "running"},
            "workoutSegments": [
                {"workoutSteps": [_pace_zone_step("interval", "time", 17 * 60, 250, 269)]}
            ],
        }
        client = _FakeClient(detail)

        entries = _build_entries(client, [("2026-07-29", "444", "", True)])

        assert entries[0]["name"] == "17'@4:20"
        assert entries[0]["type"] == "Threshold"


class _RescheduleClient:
    """A session rescheduled in Garmin Connect between two syncs; every month in the window answers."""

    def __init__(self, year: int, month: int, day: int, workout_id: str, detail: dict):
        self._year, self._month, self._day = year, month, day
        self._workout_id = workout_id
        self._detail = detail

    def get_calendar_month(self, year, month):
        if (year, month) != (self._year, self._month):
            return {"calendarItems": []}
        return {
            "calendarItems": [
                {
                    "date": f"{self._year:04d}-{self._month:02d}-{self._day:02d}",
                    "itemType": "workout",
                    "sport": "running",
                    "workoutId": self._workout_id,
                    "title": "",
                }
            ]
        }

    def get_workout_detail(self, workout_id):
        return self._detail

    def get_adaptive_workout_detail(self, workout_uuid):
        return self._detail


class TestStaleEntryPruning:
    def test_a_workout_moved_to_a_new_date_removes_the_old_dates_entry(self, monkeypatch, tmp_path):
        # 2026-07-10 held a Threshold session from a prior sync. In Garmin the
        # session has since moved to 2026-07-12, so this sync's calendar fetch
        # for July no longer returns anything on the 10th.
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        prior = PlannedWorkoutStore(tmp_path)
        prior.upsert({"date": "2026-07-10", "name": "Seuil", "type": "Threshold", "scheduledTime": "19:00"})
        prior.save()

        detail = {
            "workoutName": "Seuil",
            "sportType": {"sportTypeKey": "running"},
            "workoutSegments": [
                {"workoutSteps": [_pace_zone_step("interval", "time", 17 * 60, 250, 269)]}
            ],
        }
        client = _RescheduleClient(2026, 7, 12, "abc", detail)

        planned, stale_candidates = fetch_planned_workouts(
            client, since=date(2026, 7, 1), until=date(2026, 7, 31)
        )
        write_planned_workouts(planned, store=PlannedWorkoutStore(tmp_path), stale_candidates=stale_candidates)

        written = json.loads((tmp_path / "2026.json").read_text())
        dates = {e["date"] for e in written["planned"]}
        assert dates == {"2026-07-12"}

    def test_a_failed_calendar_month_does_not_prune_that_months_entries(self, monkeypatch, tmp_path):
        # A month that failed to fetch must not be read as "nothing scheduled".
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        prior = PlannedWorkoutStore(tmp_path)
        prior.upsert({"date": "2026-07-10", "name": "Seuil", "type": "Threshold", "scheduledTime": "19:00"})
        prior.save()

        class _FailingCalendarClient:
            def get_calendar_month(self, year, month):
                raise GarminAPIError(500, "boom")

        planned, stale_candidates = fetch_planned_workouts(
            _FailingCalendarClient(), since=date(2026, 7, 1), until=date(2026, 7, 31)
        )
        write_planned_workouts(planned, store=PlannedWorkoutStore(tmp_path), stale_candidates=stale_candidates)

        written = json.loads((tmp_path / "2026.json").read_text())
        assert {e["date"] for e in written["planned"]} == {"2026-07-10"}


class _DetailDownClient:
    """A calendar listing one workout on 2026-07-21 whose detail never loads."""

    def __init__(self, title: str) -> None:
        self._title = title

    def get_calendar_month(self, year, month):
        if (year, month) != (2026, 7):
            return {"calendarItems": []}
        return {
            "calendarItems": [
                {"date": "2026-07-21", "itemType": "workout", "sport": "running", "workoutId": "abc", "title": self._title}
            ]
        }

    def get_workout_detail(self, workout_id):
        raise GarminAPIError(503, f"workout/{workout_id}")


class TestFailedWorkoutDetail:
    """The complete entry on file is kept over a calendar-only stub: past the 7-day look-back nothing would repair it."""

    _COMPLETE = {
        "date": "2026-07-21",
        "name": "17'@4:20",
        "distanceM": 8000,
        "durationSecs": 2880,
        "type": "Threshold",
        "scheduledTime": "Evening",
    }

    def _sync(self, tmp_path, client):
        planned, stale_candidates = fetch_planned_workouts(
            client, since=date(2026, 7, 1), until=date(2026, 7, 31)
        )
        write_planned_workouts(planned, store=PlannedWorkoutStore(tmp_path), stale_candidates=stale_candidates)
        return PlannedWorkoutStore(tmp_path).get("2026-07-21")

    def _seed(self, tmp_path):
        prior = PlannedWorkoutStore(tmp_path)
        prior.upsert(dict(self._COMPLETE))
        prior.save()

    def test_the_complete_entry_on_file_is_kept(self, monkeypatch, tmp_path):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        self._seed(tmp_path)

        assert self._sync(tmp_path, _DetailDownClient("Seuil")) == self._COMPLETE

    def test_without_a_calendar_title_it_is_not_pruned_either(self, monkeypatch, tmp_path):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)
        self._seed(tmp_path)

        assert self._sync(tmp_path, _DetailDownClient("")) == self._COMPLETE

    def test_with_nothing_on_file_the_calendar_title_stands_in(self, monkeypatch, tmp_path):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)

        stub = self._sync(tmp_path, _DetailDownClient("Seuil"))

        assert stub["name"] == "Seuil"
        assert "distanceM" not in stub

    def test_with_nothing_on_file_and_no_title_nothing_is_written(self, monkeypatch, tmp_path):
        monkeypatch.setattr("sync_workouts.time.sleep", lambda *_: None)

        assert self._sync(tmp_path, _DetailDownClient("")) is None


class TestWritePlannedWorkouts:
    def test_reinfers_type_when_workout_name_at_that_date_changed(self, tmp_path):
        # The plan was reordered upstream: a footing replaced the VO2Max session on this date.
        prior = PlannedWorkoutStore(tmp_path)
        prior.upsert({"date": "2026-07-14", "name": "9 x 400m (R=1 min)", "type": "VO2Max", "scheduledTime": "19:00"})
        prior.save()

        write_planned_workouts(
            [{"date": "2026-07-14", "name": "Footing 60min"}],
            store=PlannedWorkoutStore(tmp_path),
        )

        written = json.loads((tmp_path / "2026.json").read_text())
        assert written["planned"][0]["type"] == "Base"

    def test_keeps_prior_type_when_workout_name_unchanged(self, tmp_path):
        prior = PlannedWorkoutStore(tmp_path)
        prior.upsert({"date": "2026-07-14", "name": "Footing 60min", "type": "Tempo", "scheduledTime": "07:00"})
        prior.save()

        write_planned_workouts(
            [{"date": "2026-07-14", "name": "Footing 60min"}],
            store=PlannedWorkoutStore(tmp_path),
        )

        written = json.loads((tmp_path / "2026.json").read_text())
        # A correction for the same workout name survives, though infer_planned_type would guess otherwise.
        assert written["planned"][0]["type"] == "Tempo"
        assert written["planned"][0]["scheduledTime"] == "Morning"

    def test_reads_the_coaching_plans_english_titles(self):
        # The coaching plan pushes English titles to Garmin.
        assert infer_planned_type("Threshold 3 x 7:00") == "Threshold"
        assert infer_planned_type("VO2max 5 x 3:00") == "VO2Max"
        assert infer_planned_type("Strides 6 x 20s") == "Base"
        assert infer_planned_type("Long run") == "Base"

    def test_retypes_a_stored_base_the_name_now_reads_across_the_whole_history(self, tmp_path):
        # Stored Base outside this sync's window, same name: Base was the fallback, not a correction.
        prior = PlannedWorkoutStore(tmp_path)
        prior.upsert({"date": "2026-06-18", "name": "Threshold 3 x 7:00", "type": "Base", "scheduledTime": "Evening"})
        prior.upsert({"date": "2026-06-20", "name": "Long run", "type": "Base", "scheduledTime": "Evening"})
        prior.save()

        write_planned_workouts([], store=PlannedWorkoutStore(tmp_path))

        written = {e["date"]: e["type"] for e in json.loads((tmp_path / "2026.json").read_text())["planned"]}
        assert written == {"2026-06-18": "Threshold", "2026-06-20": "Base"}

    def test_still_keeps_a_type_corrected_by_hand(self, tmp_path):
        # Only Base is re-read: a correction to any other type stands.
        prior = PlannedWorkoutStore(tmp_path)
        prior.upsert({"date": "2026-06-18", "name": "Threshold 3 x 7:00", "type": "Tempo", "scheduledTime": "Evening"})
        prior.save()

        write_planned_workouts([], store=PlannedWorkoutStore(tmp_path))

        assert json.loads((tmp_path / "2026.json").read_text())["planned"][0]["type"] == "Tempo"


def _activity(date: str, description: str) -> ActivityData:
    return ActivityData(
        id="1",
        week=202629,
        date=date,
        day_of_week="Saturday",
        type="Threshold",
        description=description,
        duration_seconds=1800,
        distance_km=5.0,
        pace_sec_per_km=360.0,
        hr_zones=[],
        avg_heart_rate=150,
        rpe=None,
        comment="",
        polyline=None,
        route=None,
        elevation_gain=None,
        aer_training_effect=None,
        ana_training_effect=None,
        hr_samples=None,
        elevation_profile=None,
        calories=None,
        cadence_spm=None,
        ground_contact_ms=None,
        vertical_oscillation_mm=None,
        vertical_ratio_pct=None,
        stride_length_m=None,
        best_efforts=None,
        pace_samples=None,
        vo2max_garmin=None,
        avg_temperature=None,
        cadence_samples=None,
        splits=None,
        gear_id=None,
    )


class TestPreferPlannedName:
    def test_exact_match_is_unchanged(self):
        assert prefer_planned_name("Seuil", {"name": "Seuil"}) is None

    def test_longer_same_prefix_is_adopted(self):
        plan = {"name": "Seuil - 3x8@4:20"}
        assert prefer_planned_name("Seuil", plan) == "Seuil - 3x8@4:20"

    def test_case_insensitive_prefix_match(self):
        plan = {"name": "Seuil - 3x8@4:20"}
        assert prefer_planned_name("seuil", plan) == "Seuil - 3x8@4:20"

    def test_shorter_planned_name_is_unchanged(self):
        assert prefer_planned_name("Seuil - 3x8@4:20", {"name": "Seuil"}) is None

    def test_same_length_is_unchanged(self):
        assert prefer_planned_name("Seuil!", {"name": "Seui1?"}) is None

    def test_not_a_prefix_is_unchanged(self):
        # A genuine custom rename by the athlete - must never be clobbered.
        assert prefer_planned_name("Course avec Paul", {"name": "Seuil - 3x8@4:20"}) is None

    def test_empty_description_adopts_any_planned_name(self):
        plan = {"name": "Seuil - 3x8@4:20"}
        assert prefer_planned_name("", plan) == "Seuil - 3x8@4:20"

    def test_no_planned_name_is_unchanged(self):
        assert prefer_planned_name("Seuil", {}) is None

    def test_type_word_title_adopts_the_plans_structure_name(self):
        # Garmin Coach titles the completed run "<City> - Base", trimmed to
        # "Base" by the mapper: the plan for that day says what it really was.
        plan = {"name": "31'@5:27", "type": "Base"}
        assert prefer_planned_name("Base", plan) == "31'@5:27"

    def test_type_word_title_of_another_type_is_unchanged(self):
        # The athlete ran an easy run on a threshold day - not that session.
        plan = {"name": "3x8'@4:20", "type": "Threshold"}
        assert prefer_planned_name("Base", plan) is None

    def test_previously_enriched_title_follows_the_new_format(self):
        plan = {"name": "7x1'@3:45", "type": "Anaerobic"}
        assert prefer_planned_name("Anaerobique - 7x1:00@3:45/km", plan) == "7x1'@3:45"


class TestEnrichDescriptionFromPlan:
    def test_adopts_richer_planned_name(self, tmp_path):
        store = PlannedWorkoutStore(tmp_path)
        store.upsert({"date": "2026-07-18", "name": "Seuil - 3x8@4:20"})
        activity = _activity("2026-07-18", "Seuil")

        enrich_description_from_plan(activity, store)

        assert activity.description == "Seuil - 3x8@4:20"

    def test_no_plan_for_that_date_is_unchanged(self, tmp_path):
        store = PlannedWorkoutStore(tmp_path)
        activity = _activity("2026-07-18", "Seuil")

        enrich_description_from_plan(activity, store)

        assert activity.description == "Seuil"

    def test_custom_title_is_never_clobbered(self, tmp_path):
        store = PlannedWorkoutStore(tmp_path)
        store.upsert({"date": "2026-07-18", "name": "Seuil - 3x8@4:20"})
        activity = _activity("2026-07-18", "Course avec Paul")

        enrich_description_from_plan(activity, store)

        assert activity.description == "Course avec Paul"
