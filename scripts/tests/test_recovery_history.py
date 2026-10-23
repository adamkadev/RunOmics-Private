from datetime import date

import pytest

from garmin import recovery_history
from garmin.errors import GarminAPIError
from garmin.recovery_history import merge_days, normalize_daily_summaries, normalize_resting_hr

# Trimmed from the shapes the Personal API's daily summaries and Connect's
# userstats-service return.
SUMMARIES = [
    {"calendarDate": "2026-09-24", "heartRate": {"minValue": 44, "maxValue": 161, "restingValue": 46}},
    {"calendarDate": "2026-09-25", "heartRate": {"restingValue": 50.4}},
    {"calendarDate": "2026-09-26", "heartRate": {}},
    {"calendarDate": "2026-09-27"},
]
RESTING = {
    "allMetrics": {
        "metricsMap": {
            "WELLNESS_RESTING_HEART_RATE": [
                {"value": 46.0, "calendarDate": "2026-09-24"},
                {"value": 50.0, "calendarDate": "2026-09-25"},
                {"value": None, "calendarDate": "2026-09-26"},
            ]
        }
    }
}


class TestNormalizeDailySummaries:
    def test_keys_resting_hr_by_date(self):
        assert normalize_daily_summaries(SUMMARIES) == {"2026-09-24": 46, "2026-09-25": 50}

    # Garmin's daily value carries workout readings on some days.
    def test_drops_readings_no_resting_heart_has(self):
        readings = (("2026-08-14", 142), ("2026-08-15", 48), ("2026-08-16", 12))
        rows = [{"calendarDate": d, "heartRate": {"restingValue": v}} for d, v in readings]
        assert normalize_daily_summaries(rows) == {"2026-08-15": 48}

    def test_survives_an_empty_response(self):
        assert normalize_daily_summaries([]) == {}
        assert normalize_daily_summaries(None) == {}
        assert normalize_daily_summaries([None, {"heartRate": None}]) == {}


class TestNormalizeRestingHr:
    def test_keys_resting_hr_by_date(self):
        assert normalize_resting_hr(RESTING) == {"2026-09-24": 46, "2026-09-25": 50}

    def test_survives_an_empty_response(self):
        assert normalize_resting_hr({}) == {}
        assert normalize_resting_hr({"allMetrics": None}) == {}


class TestMergeDays:
    def test_lays_fetched_days_over_stored_ones_and_drops_hrv(self):
        stored = {"2026-09-23": {"hrv": 60, "restingHr": 47}, "2026-09-24": {"restingHr": 46}, "2026-09-22": {"hrv": 58}}
        merged = merge_days(stored, {"2026-09-24": 45, "2026-09-25": 50})
        assert merged == {
            "2026-09-23": {"restingHr": 47},
            "2026-09-24": {"restingHr": 45},
            "2026-09-25": {"restingHr": 50},
        }

    def test_is_sorted_by_date(self):
        assert list(merge_days({}, {"2026-09-25": 48, "2026-09-01": 60})) == ["2026-09-01", "2026-09-25"]


class TestSync:
    @pytest.fixture
    def out(self, tmp_path, monkeypatch):
        monkeypatch.setattr(recovery_history, "_OUT_PATH", tmp_path / "recovery_history.json")
        monkeypatch.setattr(recovery_history.time, "sleep", lambda _s: None)
        return tmp_path / "recovery_history.json"

    def test_a_refused_window_fails_the_step_after_writing_the_others(self, out):
        # A refusal that lasts must be seen, not leave the reading stale
        # without a word; what was fetched is kept all the same.
        resting = {"allMetrics": {"metricsMap": {"WELLNESS_RESTING_HEART_RATE": [{"calendarDate": "2026-10-20", "value": 47}]}}}
        answers = iter([GarminAPIError(404, "u")] + [resting] * 20)

        class Connect:
            def get_resting_hr_range(self, _start, _end):
                answer = next(answers)
                if isinstance(answer, Exception):
                    raise answer
                return answer

        with pytest.raises(RuntimeError, match="refused 1 of"):
            recovery_history.sync_recovery_history(Connect(), date(2026, 10, 23))
        assert recovery_history.read_history(out)["days"] == {"2026-10-20": {"restingHr": 47}}
