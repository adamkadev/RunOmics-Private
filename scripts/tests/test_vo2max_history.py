from datetime import date

from garmin.vo2max_history import monthly_windows, normalize_max_met

# Trimmed from a real maxmet/monthly response.
PAYLOAD = [
    {
        "userId": 133047860,
        "generic": {
            "calendarDate": "2025-08-31",
            "vo2MaxPreciseValue": 51.5,
            "vo2MaxValue": 52.0,
            "fitnessAge": None,
            "maxMetCategory": 0,
        },
        "cycling": None,
        "heatAltitudeAcclimation": None,
    },
    {
        "userId": 133047860,
        "generic": {
            "calendarDate": "2025-09-30",
            "vo2MaxPreciseValue": 51.8,
            "vo2MaxValue": 52.0,
            "fitnessAge": 22.0,
            "maxMetCategory": 0,
        },
        "cycling": None,
        "heatAltitudeAcclimation": None,
    },
]


class TestNormalizeMaxMet:
    def test_keys_samples_by_month_and_keeps_the_decimal(self):
        assert normalize_max_met(PAYLOAD) == {
            "2025-08": {"date": "2025-08-31", "vo2max": 51.5},
            "2025-09": {"date": "2025-09-30", "vo2max": 51.8, "fitnessAge": 22.0},
        }

    def test_falls_back_to_the_rounded_value(self):
        entries = [{"generic": {"calendarDate": "2025-08-31", "vo2MaxValue": 52.0}}]
        assert normalize_max_met(entries)["2025-08"]["vo2max"] == 52.0

    def test_skips_months_with_no_reading(self):
        entries = [
            {"generic": {"calendarDate": "2025-08-31", "vo2MaxPreciseValue": None}},
            {"generic": {}},
            {"cycling": None},
        ]
        assert normalize_max_met(entries) == {}

    def test_survives_an_empty_response(self):
        assert normalize_max_met([]) == {}
        assert normalize_max_met(None) == {}


class TestMonthlyWindows:
    def test_covers_a_short_span_in_one_month_aligned_window(self):
        assert monthly_windows(date(2026, 5, 13), date(2026, 7, 21)) == [
            (date(2026, 5, 1), date(2026, 7, 31))
        ]

    def test_splits_a_longer_history_into_twelve_month_windows(self):
        windows = monthly_windows(date(2024, 3, 4), date(2026, 7, 21))
        assert windows == [
            (date(2024, 3, 1), date(2025, 2, 28)),
            (date(2025, 3, 1), date(2026, 2, 28)),
            (date(2026, 3, 1), date(2026, 7, 31)),
        ]

    def test_windows_are_contiguous_and_never_exceed_a_year(self):
        windows = monthly_windows(date(2020, 1, 1), date(2026, 7, 21))
        for (_, end), (next_start, _) in zip(windows, windows[1:]):
            assert (next_start - end).days == 1
        assert all((end - start).days <= 366 for start, end in windows)
