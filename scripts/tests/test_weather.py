from datetime import date, datetime

from processing.fit_parser import ParsedFit
from processing.weather import (
    WeatherClient,
    weather_for_activity,
    weather_hour,
)


def _hourly(hours: list[str], **overrides) -> dict:
    n = len(hours)
    columns = {
        "temperature_2m": [19.0] * n,
        "apparent_temperature": [20.9] * n,
        "relative_humidity_2m": [69] * n,
        "wind_speed_10m": [7.1] * n,
        "wind_direction_10m": [170] * n,
        "precipitation": [0.0] * n,
        "weather_code": [0] * n,
    }
    columns.update(overrides)
    return {"hourly": {"time": hours, **columns}}


class TestWeatherHour:
    def test_rounds_the_run_midpoint_to_the_nearest_hour(self):
        # 07:10 + 50 min run -> midpoint 07:35 -> 08:00 bucket
        assert weather_hour(datetime(2026, 7, 29, 7, 10), 3000) == "2026-07-29T08:00"

    def test_rounds_down_when_the_midpoint_is_early_in_the_hour(self):
        # 07:00 + 50 min run -> midpoint 07:25 -> 07:00 bucket
        assert weather_hour(datetime(2026, 7, 29, 7, 0), 3000) == "2026-07-29T07:00"

    def test_midpoint_can_round_into_the_next_day(self):
        assert weather_hour(datetime(2026, 7, 31, 23, 40), 1800) == "2026-08-01T00:00"

    def test_zero_duration_uses_the_start_hour(self):
        assert weather_hour(datetime(2026, 7, 29, 7, 10), 0) == "2026-07-29T07:00"


class TestWeatherClientBatching:
    def test_one_request_serves_every_run_in_the_same_area_and_month(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return _hourly(["2026-07-29T07:00", "2026-07-30T18:00"])

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))

        first = client.snapshot(10.1234, 20.5321, "2026-07-29T07:00")
        second = client.snapshot(10.1301, 20.5405, "2026-07-30T18:00")

        assert len(calls) == 1
        assert first is not None and second is not None
        assert first.temp_c == 19.0

    def test_separate_requests_per_month_and_per_area(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return _hourly(["2026-07-29T07:00", "2026-06-29T07:00"])

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        client.snapshot(10.10, 20.50, "2026-07-29T07:00")
        client.snapshot(10.10, 20.50, "2026-06-29T07:00")
        client.snapshot(43.29, 5.37, "2026-07-29T07:00")

        assert len(calls) == 3

    def test_requested_month_is_padded_by_a_day_on_each_side(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return _hourly(["2026-08-01T00:00"])

        client = WeatherClient(fetch=fetch, today=date(2026, 8, 5))
        client.snapshot(10.10, 20.50, "2026-07-31T23:00")

        assert "start_date=2026-06-30" in calls[0]
        assert "end_date=2026-08-01" in calls[0]

    def test_archive_end_date_never_runs_past_today(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return _hourly(["2026-07-29T07:00"])

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        client.snapshot(10.10, 20.50, "2026-07-29T07:00")

        assert "end_date=2026-07-30" in calls[0]

    def test_no_archive_request_for_a_month_that_has_not_started(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return _hourly([])

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        client.snapshot(10.10, 20.50, "2026-09-10T07:00")

        assert not any("archive" in url for url in calls)

    def test_grid_rounding_is_reflected_in_the_requested_coordinates(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return _hourly([])

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        client.snapshot(10.1234, 20.5321, "2026-07-29T07:00")

        assert "latitude=10.1" in calls[0]
        assert "longitude=20.5" in calls[0]


class TestArchiveFallback:
    def test_null_archive_hour_falls_through_to_the_forecast_endpoint(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            if "archive" in url:
                return _hourly(["2026-07-29T07:00"], temperature_2m=[None])
            return _hourly(["2026-07-29T07:00"], temperature_2m=[21.5])

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        snapshot = client.snapshot(10.10, 20.50, "2026-07-29T07:00")

        assert len(calls) == 2
        assert "archive" in calls[0]
        assert "past_days" in calls[1]
        assert snapshot is not None and snapshot.temp_c == 21.5

    def test_no_forecast_request_for_a_month_beyond_the_forecast_window(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return _hourly([])

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        assert client.snapshot(10.10, 20.50, "2025-05-12T07:00") is None
        assert len(calls) == 1  # archive only

    def test_forecast_is_skipped_when_the_archive_already_answered(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return _hourly(["2026-07-29T07:00"])

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        assert client.snapshot(10.10, 20.50, "2026-07-29T07:00") is not None
        assert len(calls) == 1


class TestGracefulFailure:
    def test_a_raising_fetch_yields_no_weather(self):
        def fetch(url: str) -> dict:
            raise OSError("connection reset")

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        assert client.snapshot(10.10, 20.50, "2026-07-29T07:00") is None
        assert client.failures == 2  # archive, then forecast

    def test_an_api_error_payload_yields_no_weather(self):
        client = WeatherClient(
            fetch=lambda url: {"error": True, "reason": "start_date is out of range"},
            today=date(2026, 7, 30),
        )
        assert client.snapshot(10.10, 20.50, "2026-07-29T07:00") is None

    def test_a_failed_group_is_not_retried_for_a_second_lookup(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            raise OSError("connection reset")

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        client.snapshot(10.10, 20.50, "2026-07-29T07:00")
        client.snapshot(10.10, 20.50, "2026-07-29T18:00")

        assert len(calls) == 2  # archive + forecast, once each


class TestWeatherForActivity:
    def _parsed(self, **overrides) -> ParsedFit:
        defaults = {
            "route": [[20.5321, 10.1234], [20.5030, 10.1040]],
            "start_time_local": datetime(2026, 7, 29, 7, 10),
            "duration_seconds": 3000,
        }
        return ParsedFit(**{**defaults, **overrides})

    def test_maps_the_snapshot_to_the_json_shape(self):
        client = WeatherClient(
            fetch=lambda url: _hourly(["2026-07-29T08:00"]),
            today=date(2026, 7, 30),
        )
        assert weather_for_activity(client, self._parsed()) == {
            "tempC": 19.0,
            "apparentTempC": 20.9,
            "humidityPct": 69,
            "windKph": 7.1,
            "windDirDeg": 170,
            "precipitationMm": 0.0,
            "code": 0,
        }

    def test_reads_the_coordinates_from_the_first_route_point(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return _hourly([])

        client = WeatherClient(fetch=fetch, today=date(2026, 7, 30))
        weather_for_activity(client, self._parsed())

        assert "latitude=10.1" in calls[0]
        assert "longitude=20.5" in calls[0]

    def test_no_route_means_no_lookup(self):
        calls: list[str] = []
        client = WeatherClient(fetch=lambda url: calls.append(url) or {}, today=date(2026, 7, 30))

        assert weather_for_activity(client, self._parsed(route=[])) is None
        assert calls == []

    def test_no_start_time_means_no_lookup(self):
        calls: list[str] = []
        client = WeatherClient(fetch=lambda url: calls.append(url) or {}, today=date(2026, 7, 30))

        assert weather_for_activity(client, self._parsed(start_time_local=None)) is None
        assert calls == []
