from garmin.recovery_history import merge_nights, normalize_hrv, normalize_resting_hr

# Trimmed from the shapes hrv-service and userstats-service return.
HRV_RANGE = {
    "hrvSummaries": [
        {"calendarDate": "2026-09-24", "weeklyAvg": 58, "lastNightAvg": 61, "status": "BALANCED"},
        {"calendarDate": "2026-09-25", "weeklyAvg": 57, "lastNightAvg": 48.4, "status": "LOW"},
        {"calendarDate": "2026-09-26", "weeklyAvg": 57, "lastNightAvg": None},
    ],
    "userProfilePk": 1,
}
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


class TestNormalizeHrv:
    def test_keys_last_night_averages_by_date(self):
        assert normalize_hrv(HRV_RANGE) == {"2026-09-24": 61, "2026-09-25": 48}

    def test_reads_a_one_night_response(self):
        payload = {"hrvSummary": {"calendarDate": "2026-09-24", "lastNightAvg": 61}}
        assert normalize_hrv(payload) == {"2026-09-24": 61}

    def test_survives_an_empty_response(self):
        assert normalize_hrv({}) == {}
        assert normalize_hrv(None) == {}
        assert normalize_hrv({"hrvSummaries": None}) == {}


class TestNormalizeRestingHr:
    def test_keys_resting_hr_by_date(self):
        assert normalize_resting_hr(RESTING) == {"2026-09-24": 46, "2026-09-25": 50}

    def test_drops_readings_no_resting_heart_has(self):
        payload = {"allMetrics": {"metricsMap": {"WELLNESS_RESTING_HEART_RATE": [
            {"calendarDate": "2026-08-14", "value": 142},
            {"calendarDate": "2026-08-15", "value": 48},
            {"calendarDate": "2026-08-16", "value": 12},
        ]}}}
        assert normalize_resting_hr(payload) == {"2026-08-15": 48}

    def test_survives_an_empty_response(self):
        assert normalize_resting_hr({}) == {}
        assert normalize_resting_hr({"allMetrics": None}) == {}


class TestMergeNights:
    def test_lays_fetched_fields_over_stored_ones(self):
        stored = {"2026-09-23": {"hrv": 60, "restingHr": 47}, "2026-09-24": {"hrv": 59, "restingHr": 46}}
        merged = merge_nights(stored, {"2026-09-24": 61, "2026-09-25": 48}, {"2026-09-25": 50})
        assert merged == {
            "2026-09-23": {"hrv": 60, "restingHr": 47},
            "2026-09-24": {"hrv": 61, "restingHr": 46},
            "2026-09-25": {"hrv": 48, "restingHr": 50},
        }

    def test_is_sorted_by_date(self):
        merged = merge_nights({}, {"2026-09-25": 48, "2026-09-01": 60}, {})
        assert list(merged) == ["2026-09-01", "2026-09-25"]
