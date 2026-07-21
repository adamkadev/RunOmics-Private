from datetime import date

from garmin.training_plan import current_plan_summary, normalize_plan

# Trimmed from a real trainingplan-service/trainingplan/plans response.
PLAN_SUMMARY = {
    "trainingPlanId": 46720557,
    "trainingPlanCategory": "FBT_ADAPTIVE",
    "name": "Programme Escher Kulturlauf",
    "startDate": "2026-06-27T00:00:00.0",
    "endDate": "2026-09-05T00:00:00.0",
}

# Trimmed from a real trainingplan-service/trainingplan/fbt-adaptive/{id} response.
PLAN_DETAIL = {
    "trainingPlanId": 46720557,
    "planPhases": [
        {"startDate": "2026-07-16", "endDate": "2026-08-05", "trainingPhase": "BUILD", "currentPhase": True},
        {"startDate": "2026-08-06", "endDate": "2026-08-26", "trainingPhase": "PEAK", "currentPhase": False},
        {"startDate": "2026-08-27", "endDate": "2026-09-04", "trainingPhase": "TAPER", "currentPhase": False},
        {"startDate": "2026-09-05", "endDate": "2026-09-05", "trainingPhase": "TARGET_EVENT_DAY", "currentPhase": False},
    ],
}


class TestCurrentPlanSummary:
    def test_picks_the_plan_covering_today(self):
        assert current_plan_summary([PLAN_SUMMARY], date(2026, 7, 21)) == PLAN_SUMMARY

    def test_ignores_a_plan_that_has_not_started_or_already_ended(self):
        assert current_plan_summary([PLAN_SUMMARY], date(2026, 6, 1)) is None
        assert current_plan_summary([PLAN_SUMMARY], date(2026, 9, 6)) is None

    def test_skips_plans_that_are_not_garmin_coach(self):
        manual = {**PLAN_SUMMARY, "trainingPlanCategory": "MANUAL"}
        assert current_plan_summary([manual], date(2026, 7, 21)) is None

    def test_no_plans_at_all(self):
        assert current_plan_summary([], date(2026, 7, 21)) is None


class TestNormalizePlan:
    def test_flattens_id_name_dates_and_phases(self):
        assert normalize_plan(PLAN_SUMMARY, PLAN_DETAIL) == {
            "planId": 46720557,
            "name": "Programme Escher Kulturlauf",
            "startDate": "2026-06-27",
            "endDate": "2026-09-05",
            "phases": [
                {"phase": "BUILD", "startDate": "2026-07-16", "endDate": "2026-08-05"},
                {"phase": "PEAK", "startDate": "2026-08-06", "endDate": "2026-08-26"},
                {"phase": "TAPER", "startDate": "2026-08-27", "endDate": "2026-09-04"},
                {"phase": "TARGET_EVENT_DAY", "startDate": "2026-09-05", "endDate": "2026-09-05"},
            ],
        }

    def test_returns_none_when_the_plan_has_no_phases(self):
        assert normalize_plan(PLAN_SUMMARY, {"trainingPlanId": 46720557}) is None
        assert normalize_plan(PLAN_SUMMARY, {"planPhases": []}) is None

    def test_falls_back_to_adaptive_plan_phases(self):
        detail = {"adaptivePlanPhases": PLAN_DETAIL["planPhases"]}
        assert normalize_plan(PLAN_SUMMARY, detail)["phases"] == normalize_plan(PLAN_SUMMARY, PLAN_DETAIL)["phases"]
