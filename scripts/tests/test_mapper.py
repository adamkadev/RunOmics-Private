from datetime import datetime

from processing.activity_type import infer_type
from processing.fit_parser import ParsedFit
from processing.mapper import (
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


class TestParseHrZones:
    def test_percentages_and_boundaries(self):
        zones = parse_hr_zones([
            {"zoneNumber": 2, "secsInZone": 300, "zoneLowBoundary": 120, "zoneHighBoundary": 145},
            {"zoneNumber": 1, "secsInZone": 700, "zoneLowBoundary": 0, "zoneHighBoundary": 120},
        ])

        assert [z.zone for z in zones] == [1, 2]  # sorted by zone number
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
        # Garmin's "City - Name" prefix is stripped.
        assert data.description == "Morning Run"
        assert data.date == "2026-07-01"
        assert data.day_of_week == "Wednesday"
        assert data.week == 202627
        assert data.duration_seconds == 1800
        assert data.distance_km == 6.0
        assert data.pace_sec_per_km == 300.0
        assert data.avg_heart_rate == 152
        assert data.type == "Base"
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

    def test_garbage_falls_back_to_epoch(self):
        assert _parse_datetime("not a date") == datetime(1970, 1, 1)
