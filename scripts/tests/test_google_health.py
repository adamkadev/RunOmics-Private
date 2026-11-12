import json
from datetime import date

import httpx
import pytest

from google_health import health_history
from google_health.client import GoogleHealthClient, GoogleHealthError
from google_health.health_history import (
    fetch_start,
    merge_days,
    normalize_hrv,
    normalize_resting_hr,
    normalize_sleep,
    normalize_steps,
    sync_health_history,
)

TRACKER = {"recordingMethod": "DERIVED", "device": {"displayName": "Tracker"}, "platform": "FITBIT"}
PHONE = {"platform": "HEALTH_KIT"}


def resting(day, bpm, source=TRACKER):
    y, m, d = map(int, day.split("-"))
    return {"dataSource": source, "dailyRestingHeartRate": {"date": {"year": y, "month": m, "day": d}, "beatsPerMinute": bpm}}


def hrv(day, ms):
    y, m, d = map(int, day.split("-"))
    return {"dataSource": TRACKER, "dailyHeartRateVariability": {"date": {"year": y, "month": m, "day": d},
                                                                 "averageHeartRateVariabilityMilliseconds": ms}}


def night(start, end, *, offset="3600s", asleep="400", awake="20", stages=None, source=TRACKER):
    sleep = {
        "interval": {"startTime": start, "startUtcOffset": offset, "endTime": end, "endUtcOffset": offset},
        "type": "STAGES",
        "summary": {"minutesAsleep": asleep, "minutesAwake": awake},
    }
    if stages is not None:
        sleep["stages"] = stages
    return {"dataSource": source, "sleep": sleep}


def steps_row(day, count):
    y, m, d = map(int, day.split("-"))
    return {"civilStartTime": {"date": {"year": y, "month": m, "day": d}, "time": {}}, "steps": {"countSum": count}}


class TestNormalizeRestingHr:
    def test_reads_the_tracker_and_parses_the_string_count(self):
        assert normalize_resting_hr([resting("2026-03-02", "47")]) == {"2026-03-02": 47}

    def test_drops_what_the_phone_reports(self):
        points = [resting("2026-03-02", "47"), resting("2026-03-03", "131", PHONE), resting("2026-03-03", "48")]
        assert normalize_resting_hr(points) == {"2026-03-02": 47, "2026-03-03": 48}

    def test_drops_a_reading_no_resting_heart_has(self):
        assert normalize_resting_hr([resting("2026-03-02", "12"), resting("2026-03-03", "140")]) == {}

    def test_survives_an_empty_or_odd_response(self):
        assert normalize_resting_hr(None) == {}
        assert normalize_resting_hr([None, {"dataSource": TRACKER}, resting("2026-03-02", "x")]) == {}


class TestNormalizeHrv:
    def test_keeps_one_decimal(self):
        assert normalize_hrv([hrv("2026-03-02", 61.27)]) == {"2026-03-02": 61.3}

    def test_drops_an_impossible_value(self):
        assert normalize_hrv([hrv("2026-03-02", 0), hrv("2026-03-03", 900)]) == {}


class TestNormalizeSteps:
    def test_keys_the_count_by_local_day(self):
        assert normalize_steps([steps_row("2026-03-02", "8123"), steps_row("2026-03-03", "0")]) == {
            "2026-03-02": 8123,
            "2026-03-03": 0,
        }

    def test_survives_a_row_without_steps(self):
        assert normalize_steps([{"civilStartTime": {"date": {"year": 2026, "month": 3, "day": 2}}}]) == {}


class TestNormalizeSleep:
    def test_files_a_night_under_the_local_day_it_ended(self):
        nights = normalize_sleep([night("2026-03-01T22:00:00Z", "2026-03-02T05:30:00Z")])
        assert list(nights) == ["2026-03-02"]
        assert nights["2026-03-02"]["asleepMinutes"] == 400
        assert nights["2026-03-02"]["awakeMinutes"] == 20

    def test_a_wake_up_past_midnight_utc_counts_on_the_local_day(self):
        nights = normalize_sleep([night("2026-03-01T15:00:00Z", "2026-03-01T23:30:00Z")])
        assert list(nights) == ["2026-03-02"]

    def test_sums_the_stages(self):
        stages = [
            {"startTime": "2026-03-01T22:00:00Z", "endTime": "2026-03-01T23:00:00Z", "type": "LIGHT"},
            {"startTime": "2026-03-01T23:00:00Z", "endTime": "2026-03-01T23:45:00Z", "type": "DEEP"},
            {"startTime": "2026-03-01T23:45:00Z", "endTime": "2026-03-02T00:15:00Z", "type": "REM"},
            {"startTime": "2026-03-02T00:15:00Z", "endTime": "2026-03-02T00:25:00Z", "type": "AWAKE"},
        ]
        nights = normalize_sleep([night("2026-03-01T22:00:00Z", "2026-03-02T00:25:00Z", stages=stages)])
        assert nights["2026-03-02"] == {
            "start": "2026-03-01T22:00:00Z",
            "end": "2026-03-02T00:25:00Z",
            "asleepMinutes": 400,
            "awakeMinutes": 20,
            "lightMinutes": 60,
            "deepMinutes": 45,
            "remMinutes": 30,
        }

    def test_falls_back_on_the_stages_without_a_summary(self):
        stages = [
            {"startTime": "2026-03-01T22:00:00Z", "endTime": "2026-03-02T04:00:00Z", "type": "LIGHT"},
            {"startTime": "2026-03-02T04:00:00Z", "endTime": "2026-03-02T04:30:00Z", "type": "AWAKE"},
        ]
        point = night("2026-03-01T22:00:00Z", "2026-03-02T04:30:00Z", stages=stages)
        del point["sleep"]["summary"]
        assert normalize_sleep([point])["2026-03-02"]["asleepMinutes"] == 360

    def test_a_nap_does_not_replace_the_night(self):
        nap = night("2026-03-02T13:00:00Z", "2026-03-02T13:40:00Z", asleep="35")
        points = [night("2026-03-01T22:00:00Z", "2026-03-02T05:30:00Z"), nap]
        assert normalize_sleep(points)["2026-03-02"]["asleepMinutes"] == 400

    def test_drops_what_another_source_logged(self):
        assert normalize_sleep([night("2026-03-01T22:00:00Z", "2026-03-02T05:30:00Z", source=PHONE)]) == {}

    def test_drops_a_session_with_no_sleep_in_it(self):
        assert normalize_sleep([night("2026-03-01T22:00:00Z", "2026-03-02T05:30:00Z", asleep="0")]) == {}


class TestMergeDays:
    def test_lays_each_fetched_field_over_the_stored_day(self):
        stored = {"2026-03-01": {"restingHr": 48, "steps": 5000}, "2026-03-02": {"restingHr": 49}}
        merged = merge_days(stored, {"restingHr": {"2026-03-02": 47}, "steps": {"2026-03-03": 7000}})
        assert merged == {
            "2026-03-01": {"restingHr": 48, "steps": 5000},
            "2026-03-02": {"restingHr": 47},
            "2026-03-03": {"steps": 7000},
        }


class TestFetchStart:
    def test_reaches_back_a_year_the_first_time(self):
        assert fetch_start({}, date(2026, 3, 10)) == date(2025, 3, 11)

    def test_then_refreshes_the_last_week_from_the_newest_day(self):
        assert fetch_start({"2026-03-01": {}, "2026-03-04": {}}, date(2026, 3, 10)) == date(2026, 2, 25)


def client_with(handler, sleeps=None):
    def recorded(seconds):
        if sleeps is not None:
            sleeps.append(seconds)

    return GoogleHealthClient("id", "secret", "refresh", transport=httpx.MockTransport(handler), sleep=recorded)


def token_or(handler):
    def route(request):
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "access", "expires_in": 3599})
        return handler(request)

    return route


class TestClient:
    def test_reads_every_page_with_the_bearer_and_wearables_only(self):
        seen = []

        def handler(request):
            seen.append(request)
            page = request.url.params.get("pageToken")
            body = {"dataPoints": [{"n": 2}]} if page else {"dataPoints": [{"n": 1}], "nextPageToken": "p2"}
            return httpx.Response(200, json=body)

        client = client_with(token_or(handler))
        points = client.list_points("daily-resting-heart-rate", "date", date(2026, 3, 1), date(2026, 3, 3))
        assert points == [{"n": 1}, {"n": 2}]
        assert all(r.headers["Authorization"] == "Bearer access" for r in seen)
        assert seen[0].url.params["filter"] == (
            'daily_resting_heart_rate.date >= "2026-03-01" AND daily_resting_heart_rate.date < "2026-03-03"'
        )
        assert seen[0].url.params["dataSourceFamily"] == "users/me/dataSourceFamilies/google-wearables"

    def test_sleep_is_asked_without_a_source_family(self):
        seen = []

        def handler(request):
            seen.append(request)
            return httpx.Response(200, json={})

        client = client_with(token_or(handler))
        client.list_points("sleep", "interval.civil_end_time", date(2026, 3, 1), date(2026, 3, 3), wearables_only=False)
        assert "dataSourceFamily" not in seen[0].url.params
        assert seen[0].url.params["pageSize"] == "25"

    def test_rolls_steps_up_ninety_days_at_a_time(self):
        ranges = []

        def handler(request):
            body = json.loads(request.content)
            ranges.append((body["range"]["start"]["date"], body["range"]["end"]["date"]))
            assert body["dataSourceFamily"] == "users/me/dataSourceFamilies/google-wearables"
            return httpx.Response(200, json={"rollupDataPoints": [{}]})

        rows = client_with(token_or(handler)).daily_steps(date(2026, 1, 1), date(2026, 5, 1))
        assert len(rows) == 2
        assert ranges == [
            ({"year": 2026, "month": 1, "day": 1}, {"year": 2026, "month": 4, "day": 1}),
            ({"year": 2026, "month": 4, "day": 1}, {"year": 2026, "month": 5, "day": 1}),
        ]

    def test_a_refused_refresh_token_says_how_to_mint_another(self):
        def handler(request):
            return httpx.Response(400, json={"error": "invalid_grant"})

        with pytest.raises(GoogleHealthError, match="google_health_setup.sh"):
            client_with(handler).list_points("steps", "interval.start_time", date(2026, 3, 1), date(2026, 3, 2))

    def test_retries_a_server_error(self):
        answers = iter([httpx.Response(503), httpx.Response(200, json={"dataPoints": [{"n": 1}]})])
        sleeps = []
        points = client_with(token_or(lambda request: next(answers)), sleeps).list_points(
            "daily-heart-rate-variability", "date", date(2026, 3, 1), date(2026, 3, 2)
        )
        assert points == [{"n": 1}]
        assert sleeps == [4.0]

    def test_does_not_retry_a_bad_request(self):
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(400, json={"error": {"status": "INVALID_ARGUMENT"}})

        with pytest.raises(GoogleHealthError, match="INVALID_ARGUMENT"):
            client_with(token_or(handler)).list_points("sleep", "interval.civil_end_time", date(2026, 3, 1), date(2026, 3, 2))
        assert len(calls) == 1

    def test_reads_its_credentials_from_the_environment(self, monkeypatch):
        for name in ("CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"):
            monkeypatch.setenv(f"GOOGLE_HEALTH_{name}", "x")
        assert GoogleHealthClient.from_env() is not None
        monkeypatch.setenv("GOOGLE_HEALTH_REFRESH_TOKEN", " ")
        assert GoogleHealthClient.from_env() is None


class FakeClient:
    def __init__(self, refuse=()):
        self.refuse = set(refuse)

    def list_points(self, data_type, field, start, end, *, wearables_only=True):
        if data_type in self.refuse:
            raise GoogleHealthError(f"{data_type} answered HTTP 403", 403)
        return {
            "daily-resting-heart-rate": [resting("2026-03-02", "47")],
            "daily-heart-rate-variability": [hrv("2026-03-02", 61.2)],
            "sleep": [night("2026-03-01T22:00:00Z", "2026-03-02T05:30:00Z", asleep="401")],
        }[data_type]

    def daily_steps(self, start, end):
        return [steps_row("2026-03-02", "8123")]


@pytest.fixture
def out_path(tmp_path, monkeypatch):
    path = tmp_path / "health_history.json"
    monkeypatch.setattr(health_history, "_OUT_PATH", path)
    return path


class TestSyncHealthHistory:
    def test_writes_every_field_under_its_day(self, out_path):
        assert sync_health_history(FakeClient(), today=date(2026, 3, 3)) == 1
        day = json.loads(out_path.read_text())["days"]["2026-03-02"]
        assert (day["restingHr"], day["hrvMs"], day["steps"], day["sleep"]["asleepMinutes"]) == (47, 61.2, 8123, 401)

    def test_a_dry_run_writes_nothing(self, out_path):
        sync_health_history(FakeClient(), dry_run=True, today=date(2026, 3, 3))
        assert not out_path.exists()

    def test_a_refused_type_still_writes_the_others_and_fails_the_step(self, out_path):
        with pytest.raises(RuntimeError, match="sleep"):
            sync_health_history(FakeClient(refuse={"sleep"}), today=date(2026, 3, 3))
        day = json.loads(out_path.read_text())["days"]["2026-03-02"]
        assert "sleep" not in day and day["restingHr"] == 47

    def test_the_log_carries_counts_and_never_a_reading(self, out_path, capsys):
        sync_health_history(FakeClient(), today=date(2026, 3, 3))
        log = capsys.readouterr().out
        assert "1 restingHr" in log
        for reading in ("47", "61.2", "8123", "401"):
            assert reading not in log
