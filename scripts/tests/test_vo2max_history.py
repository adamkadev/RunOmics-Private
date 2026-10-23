from datetime import date
from itertools import pairwise

import pytest

from garmin import vo2max_history
from garmin.vo2max_history import monthly_windows, normalize_max_met, samples_from_runs
from repository.history_file import read_history, write_history

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
        for (_, end), (next_start, _) in pairwise(windows):
            assert (next_start - end).days == 1
        assert all((end - start).days <= 366 for start, end in windows)


class TestCarriedOnFromRuns:
    """Without Connect, the runs' own FIT readings carry the series on: within
    0.1 of Connect's daily value, so they fill only what Connect never had."""

    @pytest.fixture
    def out(self, tmp_path, monkeypatch):
        path = tmp_path / "vo2max_history.json"
        monkeypatch.setattr(vo2max_history, "_OUT_PATH", path)
        return path

    def test_takes_each_days_last_run_and_only_runs(self):
        # Stored dates carry no time: the later run of a day has the larger id.
        runs = [
            {"id": "200", "date": "2026-10-21", "sport": "running", "vo2maxGarmin": 37.4},
            {"id": "199", "date": "2026-10-21", "sport": "trail_running", "vo2maxGarmin": 37.2},
            {"id": "201", "date": "2026-10-22", "sport": "cycling", "vo2maxGarmin": 51.0},
            {"id": "202", "date": "2026-10-23", "vo2maxGarmin": None},
        ]
        assert samples_from_runs(runs) == {"2026-10-21": {"date": "2026-10-21", "vo2max": 37.4, "source": "fit"}}

    def test_carries_on_only_after_connects_last_sample(self, out):
        # Before it, Connect was answering: a run it left unsampled had not
        # moved VO2max, and its closed months stay as it sampled them.
        connect = {
            "months": {"2026-10": {"date": "2026-10-16", "vo2max": 37.2, "fitnessAge": 24.4}},
            "days": {"2026-10-16": {"date": "2026-10-16", "vo2max": 37.2}},
        }
        write_history(out, connect)
        runs = [_run("1", "2026-09-30", 36.9), _run("2", "2026-10-16", 37.1), _run("3", "2026-10-18", 37.4)]

        assert vo2max_history.sync_vo2max_from_runs(runs, date(2026, 10, 23)) == 1

        stored = read_history(out)
        # The month keeps the fitness age only Connect knows.
        assert stored["months"] == {"2026-10": {"date": "2026-10-18", "vo2max": 37.4, "source": "fit", "fitnessAge": 24.4}}
        assert stored["days"] == {**connect["days"], "2026-10-18": {"date": "2026-10-18", "vo2max": 37.4, "source": "fit"}}

    def test_a_later_run_on_a_day_already_carried_still_counts(self, out):
        # The Sync button carried the morning run; the evening one comes at night.
        write_history(out, {"months": {}, "days": {}})
        vo2max_history.sync_vo2max_from_runs([_run("1", "2026-10-21", 37.2)], date(2026, 10, 23))

        vo2max_history.sync_vo2max_from_runs([_run("1", "2026-10-21", 37.2), _run("2", "2026-10-21", 37.4)], date(2026, 10, 23))

        assert read_history(out)["days"]["2026-10-21"]["vo2max"] == 37.4

    def test_nothing_after_connects_last_sample_rewrites_nothing(self, out):
        write_history(out, {"months": {"2026-10": {"date": "2026-10-21", "vo2max": 37.4}}, "days": {}})
        before = out.read_text()

        vo2max_history.sync_vo2max_from_runs([_run("1", "2026-10-21", 37.3)], date(2026, 10, 23))

        assert out.read_text() == before
        assert vo2max_history.newest_carried_vo2max() is None

    def test_the_newest_carried_reading_is_what_the_athlete_takes(self, out):
        write_history(out, {"months": {"2026-10": {"date": "2026-10-16", "vo2max": 37.2}}, "days": {}})
        vo2max_history.sync_vo2max_from_runs([_run("1", "2026-10-21", 37.3)], date(2026, 10, 23))

        assert vo2max_history.newest_carried_vo2max() == 37.3

    def test_connect_back_replaces_every_carried_sample(self, out, monkeypatch):
        write_history(out, {
            "months": {"2026-10": {"date": "2026-10-21", "vo2max": 37.3, "source": "fit"}},
            "days": {"2026-10-21": {"date": "2026-10-21", "vo2max": 37.3, "source": "fit"}},
        })
        monkeypatch.setattr(vo2max_history, "_fetch_months", lambda *_: {"2026-10": {"date": "2026-10-22", "vo2max": 37.4}})
        monkeypatch.setattr(vo2max_history, "_fetch_days", lambda *_: {"2026-10-22": {"date": "2026-10-22", "vo2max": 37.4}})

        vo2max_history.sync_vo2max_history(object(), date(2026, 9, 1), date(2026, 10, 23))

        assert read_history(out) == {
            "months": {"2026-10": {"date": "2026-10-22", "vo2max": 37.4}},
            "days": {"2026-10-22": {"date": "2026-10-22", "vo2max": 37.4}},
        }


def _run(activity_id, day, vo2max):
    return {"id": activity_id, "date": day, "sport": "running", "vo2maxGarmin": vo2max}
