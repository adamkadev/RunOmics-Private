from datetime import date

from garmin.training_status import (
    dates_to_fetch,
    normalize_load_balance,
    normalize_training_status,
)

# Trimmed from real Garmin responses.
STATUS_PAYLOAD = {
    "userId": 133047860,
    "latestTrainingStatusData": {
        "3604810488": {
            "calendarDate": "2026-07-21",
            "trainingStatus": 5,
            "deviceId": 3604810488,
            "sport": "RUNNING",
            "fitnessTrend": 2,
            "trainingStatusFeedbackPhrase": "RECOVERY_2",
            "trainingPaused": False,
            "acuteTrainingLoadDTO": {
                "acwrPercent": 12,
                "acwrStatus": "LOW",
                "dailyTrainingLoadAcute": 108,
                "maxTrainingLoadChronic": 426.0,
                "minTrainingLoadChronic": 227.20000000000002,
                "dailyTrainingLoadChronic": 284,
                "dailyAcuteChronicWorkloadRatio": 0.3,
            },
            "primaryTrainingDevice": True,
        }
    },
}

BALANCE_PAYLOAD = {
    "userId": 133047860,
    "metricsTrainingLoadBalanceDTOMap": {
        "3604810488": {
            "calendarDate": "2026-07-21",
            "deviceId": 3604810488,
            "monthlyLoadAerobicLow": 282.92175,
            "monthlyLoadAerobicHigh": 733.9694,
            "monthlyLoadAnaerobic": 26.108826,
            "monthlyLoadAerobicLowTargetMin": 652,
            "monthlyLoadAerobicLowTargetMax": 1196,
            "monthlyLoadAerobicHighTargetMin": 761,
            "monthlyLoadAerobicHighTargetMax": 1305,
            "monthlyLoadAnaerobicTargetMin": 326,
            "monthlyLoadAnaerobicTargetMax": 652,
            "trainingBalanceFeedbackPhrase": "BELOW_TARGETS",
            "primaryTrainingDevice": True,
        }
    },
}


class TestNormalizeTrainingStatus:
    def test_flattens_the_primary_device_entry(self):
        day = normalize_training_status(STATUS_PAYLOAD)
        assert day == {
            "status": "recovery",
            "statusCode": 5,
            "feedback": "RECOVERY_2",
            "fitnessTrend": 2,
            "acuteLoad": 108,
            "chronicLoad": 284,
            "acwr": 0.3,
            "acwrStatus": "LOW",
            "chronicLoadMin": 227.20000000000002,
            "chronicLoadMax": 426.0,
            "deviceId": 3604810488,
        }

    def test_prefers_the_primary_device_over_map_order(self):
        payload = {
            "latestTrainingStatusData": {
                "111": {"trainingStatusFeedbackPhrase": "PRODUCTIVE_1", "deviceId": 111},
                "222": {
                    "trainingStatusFeedbackPhrase": "RECOVERY_2",
                    "deviceId": 222,
                    "primaryTrainingDevice": True,
                },
            }
        }
        assert normalize_training_status(payload)["deviceId"] == 222

    def test_status_label_strips_only_the_variant_number(self):
        payload = {
            "latestTrainingStatusData": {
                "1": {"trainingStatusFeedbackPhrase": "NO_STATUS", "primaryTrainingDevice": True}
            }
        }
        assert normalize_training_status(payload)["status"] == "no_status"

    def test_returns_none_for_a_day_the_watch_was_not_worn(self):
        assert normalize_training_status({"latestTrainingStatusData": {}}) is None
        assert normalize_training_status({}) is None

    def test_returns_none_when_neither_status_nor_load_was_recorded(self):
        payload = {"latestTrainingStatusData": {"1": {"deviceId": 1, "trainingPaused": False}}}
        assert normalize_training_status(payload) is None


class TestNormalizeLoadBalance:
    def test_flattens_buckets_with_their_targets(self):
        balance = normalize_load_balance(BALANCE_PAYLOAD)
        assert balance["feedback"] == "BELOW_TARGETS"
        assert balance["aerobicLow"] == 282.92175
        assert (balance["aerobicLowMin"], balance["aerobicLowMax"]) == (652, 1196)
        assert (balance["anaerobicMin"], balance["anaerobicMax"]) == (326, 652)

    def test_returns_none_when_nothing_was_recorded(self):
        assert normalize_load_balance({"metricsTrainingLoadBalanceDTOMap": {}}) is None


class TestDatesToFetch:
    def test_walks_the_whole_span_when_nothing_is_stored(self):
        days = dates_to_fetch(date(2026, 7, 18), date(2026, 7, 21), {})
        assert days == [date(2026, 7, 18 + i) for i in range(4)]

    def test_skips_stored_days_outside_the_refresh_window(self):
        stored = {"2026-05-01": {}, "2026-05-02": {}}
        days = dates_to_fetch(date(2026, 5, 1), date(2026, 5, 20), stored)
        assert date(2026, 5, 1) not in days
        assert date(2026, 5, 2) not in days
        assert days[0] == date(2026, 5, 3)

    def test_refetches_stored_days_inside_the_refresh_window(self):
        stored = {"2026-07-20": {}, "2026-07-21": {}}
        days = dates_to_fetch(date(2026, 7, 20), date(2026, 7, 21), stored)
        assert days == [date(2026, 7, 20), date(2026, 7, 21)]
