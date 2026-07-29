from datetime import date, timedelta

from garmin.training_status import (
    dates_to_fetch,
    fetch_windows,
    normalize_load_balance,
    normalize_status_report,
    weekly_windows,
)

# Trimmed from real Garmin responses.
STATUS_PAYLOAD = {
    "userId": 133047860,
    "fromCalendarDate": "2026-07-20",
    "toCalendarDate": "2026-07-21",
    "reportData": {
        "3604810488": [
            {
                "calendarDate": "2026-07-20",
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
            },
            {
                "calendarDate": "2026-07-21",
                "trainingStatus": 2,
                "deviceId": 3604810488,
                "sport": "RUNNING",
                "fitnessTrend": 1,
                "trainingStatusFeedbackPhrase": "UNPRODUCTIVE_2",
                "trainingPaused": False,
                "acuteTrainingLoadDTO": {
                    "acwrPercent": 47,
                    "acwrStatus": "OPTIMAL",
                    "dailyTrainingLoadAcute": 363,
                    "maxTrainingLoadChronic": 495.0,
                    "minTrainingLoadChronic": 264.0,
                    "dailyTrainingLoadChronic": 330,
                    "dailyAcuteChronicWorkloadRatio": 1.1,
                },
                "primaryTrainingDevice": True,
            },
        ]
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


class TestNormalizeStatusReport:
    def test_keys_flattened_days_by_calendar_date(self):
        days = normalize_status_report(STATUS_PAYLOAD)
        assert list(days) == ["2026-07-20", "2026-07-21"]
        assert days["2026-07-20"] == {
            "status": "recovery",
            "statusCode": 5,
            "feedback": "RECOVERY_2",
            "fitnessTrend": 2,
            "acuteLoad": 108,
            "chronicLoad": 284,
            "acwr": 0.3,
            "acwrStatus": "LOW",
            "chronicLoadMin": 227,
            "chronicLoadMax": 426,
            "deviceId": 3604810488,
        }
        assert days["2026-07-21"]["status"] == "unproductive"

    def test_prefers_the_primary_device_over_map_order(self):
        payload = {
            "reportData": {
                "111": [
                    {
                        "calendarDate": "2026-07-21",
                        "trainingStatusFeedbackPhrase": "PRODUCTIVE_1",
                        "deviceId": 111,
                    }
                ],
                "222": [
                    {
                        "calendarDate": "2026-07-21",
                        "trainingStatusFeedbackPhrase": "RECOVERY_2",
                        "deviceId": 222,
                        "primaryTrainingDevice": True,
                    }
                ],
            }
        }
        assert normalize_status_report(payload)["2026-07-21"]["deviceId"] == 222

    def test_status_label_strips_only_the_variant_number(self):
        payload = {
            "reportData": {
                "1": [
                    {
                        "calendarDate": "2026-07-21",
                        "trainingStatusFeedbackPhrase": "NO_STATUS",
                        "primaryTrainingDevice": True,
                    }
                ]
            }
        }
        assert normalize_status_report(payload)["2026-07-21"]["status"] == "no_status"

    def test_returns_nothing_when_the_watch_was_not_worn(self):
        assert normalize_status_report({"reportData": {}}) == {}
        assert normalize_status_report({}) == {}

    def test_drops_days_with_neither_status_nor_load(self):
        payload = {
            "reportData": {
                "1": [{"calendarDate": "2026-07-21", "deviceId": 1, "trainingPaused": False}]
            }
        }
        assert normalize_status_report(payload) == {}


class TestNormalizeLoadBalance:
    def test_flattens_buckets_with_their_targets(self):
        balance = normalize_load_balance(BALANCE_PAYLOAD)
        assert balance["feedback"] == "BELOW_TARGETS"
        assert (balance["aerobicLowMin"], balance["aerobicLowMax"]) == (652, 1196)
        assert (balance["anaerobicMin"], balance["anaerobicMax"]) == (326, 652)

    def test_stores_loads_as_whole_numbers(self):
        balance = normalize_load_balance(BALANCE_PAYLOAD)
        assert balance["aerobicLow"] == 283
        assert balance["aerobicHigh"] == 734
        assert balance["anaerobic"] == 26

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


class TestFetchWindows:
    def test_returns_nothing_when_there_is_nothing_to_fetch(self):
        assert fetch_windows([]) == []

    def test_caps_a_window_at_four_weeks(self):
        days = [date(2026, 1, 1) + timedelta(days=i) for i in range(60)]
        windows = fetch_windows(days)
        assert windows == [
            (date(2026, 1, 1), date(2026, 1, 28)),
            (date(2026, 1, 29), date(2026, 2, 25)),
            (date(2026, 2, 26), date(2026, 3, 1)),
        ]

    def test_lets_stored_days_ride_along_inside_a_window(self):
        windows = fetch_windows([date(2026, 5, 1), date(2026, 5, 20)])
        assert windows == [(date(2026, 5, 1), date(2026, 5, 20))]

    def test_splits_days_further_apart_than_a_window(self):
        windows = fetch_windows([date(2026, 5, 1), date(2026, 7, 1)])
        assert windows == [(date(2026, 5, 1), date(2026, 5, 1)), (date(2026, 7, 1), date(2026, 7, 1))]


class TestWeeklyWindows:
    def test_walks_the_whole_span_in_six_month_windows_on_a_first_run(self):
        windows = weekly_windows(date(2025, 5, 13), date(2026, 7, 29), {})
        assert windows[0][0] == date(2025, 5, 13)
        assert windows[-1][1] == date(2026, 7, 29)
        assert all((end - start).days < 182 for start, end in windows)
        assert len(windows) == 3

    def test_refetches_only_the_tail_once_weeks_are_stored(self):
        stored = {"2026-07-18": {}, "2026-07-25": {}}
        windows = weekly_windows(date(2025, 5, 13), date(2026, 7, 29), stored)
        assert windows == [(date(2026, 7, 18), date(2026, 7, 29))]

    def test_never_reaches_back_before_the_first_activity(self):
        stored = {"2025-05-17": {}}
        windows = weekly_windows(date(2025, 5, 13), date(2025, 5, 20), stored)
        assert windows == [(date(2025, 5, 13), date(2025, 5, 20))]
