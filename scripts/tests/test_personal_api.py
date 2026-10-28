"""PersonalApiClient against a fake Personal API: the key-for-token exchange,
the download's contract (the same as GarminClient's), and the HR zones it
builds from the activity list."""

import io
import zipfile

import httpx
import pytest

from garmin.errors import GarminAPIError, GarminAuthError
from garmin.personal_api import PersonalApiClient
from processing.mapper import parse_hr_zones

_KEY = "GCDC_fictional-key"


def _zip(**files: bytes) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buffer.getvalue()


ROW = {
    "activityId": 101,
    "startTimeLocal": "2026-10-21 07:00:00",
    "hrTimeInZone_1": 7.457,
    "hrTimeInZone_2": 22.0,
    "hrTimeInZone_3": 470.227,
    "hrTimeInZone_4": 1123.906,
    "hrTimeInZone_5": 374.252,
}
ZONES = [
    {"sport": "DEFAULT", "zone1Floor": 100, "zone2Floor": 120, "zone3Floor": 140, "zone4Floor": 160, "zone5Floor": 180},
    {"sport": "RUNNING", "zone1Floor": 103, "zone2Floor": 124, "zone3Floor": 144, "zone4Floor": 165, "zone5Floor": 176},
]


LIST = "/activitylist-service/activities/search/activities"
DOWNLOAD = "/download-service/files/activity/101"


def _detail(start: str) -> httpx.Response:
    return httpx.Response(200, json={"summaryDTO": {"startTimeLocal": start}})


class FakeApi:
    """Answers by path; a list of answers is served in turn, its last one for good."""

    def __init__(self, **routes):
        self.routes = {
            LIST: httpx.Response(200, json=[ROW]),
            "/biometric-service/heartRateZones/v2": httpx.Response(200, json=ZONES),
            **routes,
        }
        self.requests: list[httpx.Request] = []
        self.tokens = iter(["token-1", "token-2", "token-3"])

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.url.path.startswith("/personalapitoken-service/"):
            assert request.headers["Authorization"] == f"ApiKey {_KEY}"
            return self.routes.get("token", httpx.Response(200, text=next(self.tokens)))
        answer = self.routes.get(request.url.path, httpx.Response(404))
        if isinstance(answer, list):
            return answer.pop(0) if len(answer) > 1 else answer[0]
        return answer

    def client(self) -> PersonalApiClient:
        return PersonalApiClient(_KEY, base_url="https://personal.example.test", transport=httpx.MockTransport(self))


class TestToken:
    def test_reads_with_the_token_the_key_was_exchanged_for(self):
        api = FakeApi()
        api.client().get_activities()
        assert api.requests[-1].headers["Authorization"] == "Bearer token-1"

    @pytest.mark.parametrize(
        "status,hint",
        [(400, "malformed"), (401, "create a new one at https://connect.garmin.com/app/settings/personalApiToken"),
         (403, "Garmin blocks the address")],
    )
    def test_a_refused_key_says_what_it_most_likely_means_and_never_echoes_it(self, status, hint):
        with pytest.raises(GarminAuthError) as raised:
            FakeApi(token=httpx.Response(status)).client()
        assert f"(HTTP {status})" in str(raised.value) and hint in str(raised.value)
        assert _KEY not in str(raised.value)

    def test_an_empty_token_says_something_else_answered(self):
        with pytest.raises(GarminAuthError, match="no token"):
            FakeApi(token=httpx.Response(200, text="")).client()

    def test_a_failed_exchange_closes_the_connection_it_opened(self, monkeypatch):
        closed = []
        monkeypatch.setattr(httpx.Client, "close", lambda self: closed.append(self))
        with pytest.raises(GarminAuthError):
            FakeApi(token=httpx.Response(401)).client()
        assert len(closed) == 1

    def test_a_token_that_expires_mid_sync_is_exchanged_again_once(self):
        api = FakeApi(**{LIST: [httpx.Response(401), httpx.Response(200, json=[ROW])]})
        assert api.client().get_activities() == [ROW]
        sent = [r.headers["Authorization"] for r in api.requests]
        assert sent == [f"ApiKey {_KEY}", "Bearer token-1", f"ApiKey {_KEY}", "Bearer token-2"]


class TestDownload:
    def test_returns_the_fit_inside_the_archive_asking_for_the_type_it_is_served_as(self):
        api = FakeApi(**{DOWNLOAD: httpx.Response(200, content=_zip(**{"101_ACTIVITY.fit": b"FIT"}))})
        assert api.client().download_fit("101") == b"FIT"
        assert "application/x-zip-compressed" in api.requests[-1].headers["Accept"]

    def test_an_activity_without_a_file_is_none_unless_strict(self):
        client = FakeApi().client()
        assert client.download_fit("101") is None
        with pytest.raises(GarminAPIError):
            client.download_fit("101", strict_errors=True)

    def test_an_archive_without_a_fit_is_none(self):
        api = FakeApi(**{DOWNLOAD: httpx.Response(200, content=_zip(**{"run.gpx": b"<gpx/>"}))})
        assert api.client().download_fit("101") is None

    def test_a_download_that_is_not_an_archive_raises(self):
        api = FakeApi(**{DOWNLOAD: httpx.Response(200, content=b"<html>503</html>")})
        with pytest.raises(zipfile.BadZipFile):
            api.client().download_fit("101")

    def test_a_5xx_raises_for_the_retry(self):
        api = FakeApi(**{DOWNLOAD: httpx.Response(503)})
        with pytest.raises(GarminAPIError) as raised:
            api.client().download_fit("101")
        assert raised.value.status_code == 503


class TestHrZones:
    def test_builds_connects_shape_from_the_list_row_and_the_running_zones(self):
        client = FakeApi().client()
        client.get_activity_rows()

        zones = parse_hr_zones(client.get_hr_zones("101"))

        # The seconds are the activity's own, truncated as Connect's endpoint
        # stores them: 1123.906 s is 1123, as synced before.
        assert [(z.zone, z.seconds, z.min_bpm, z.max_bpm) for z in zones] == [
            (1, 7, 103, None), (2, 22, 124, None), (3, 470, 144, None), (4, 1123, 165, None), (5, 374, 176, None),
        ]

    def test_finds_the_row_of_an_activity_not_paged_through(self):
        api = FakeApi(**{"/activity-service/activity/101": _detail("2026-10-21T07:00:00.0")})

        zones = api.client().get_hr_zones("101")

        assert len(zones) == 5
        # A day either side: the filter's day may be GMT's where the run's is local.
        listed = [dict(r.url.params) for r in api.requests if r.url.path == LIST]
        assert listed == [{"start": "0", "limit": "100", "startDate": "2026-10-20", "endDate": "2026-10-22"}]

    def test_reuses_the_detail_the_sync_already_fetched(self):
        api = FakeApi(**{"/activity-service/activity/101": _detail("2026-10-21 07:00:00")})
        client = api.client()
        client.get_activity_detail("101")

        client.get_hr_zones("101")

        assert [r.url.path for r in api.requests].count("/activity-service/activity/101") == 1

    def test_a_row_not_found_raises_rather_than_passing_for_no_zones(self):
        # "No zones" would be stored over the zones on file.
        api = FakeApi(**{"/activity-service/activity/999": _detail("2026-10-21 07:00:00")})
        with pytest.raises(LookupError):
            api.client().get_hr_zones("999")


def test_an_empty_activity_detail_raises_rather_than_passing_for_an_activity():
    # Mapped, {} was stored for good under the id "".
    api = FakeApi(**{"/activity-service/activity/101": httpx.Response(204)})
    with pytest.raises(ValueError):
        api.client().get_activity_detail("101")


def test_daily_summaries_are_the_data_rows_and_a_204_is_none():
    rows = [{"calendarDate": "2026-10-20", "heartRate": {"restingValue": 46}}]
    api = FakeApi(**{"/usersummary-service/v2/dailysummaries": httpx.Response(200, json={"data": rows})})
    assert api.client().get_daily_summaries("2026-10-01", "2026-10-28") == rows

    api = FakeApi(**{"/usersummary-service/v2/dailysummaries": httpx.Response(204)})
    assert api.client().get_daily_summaries("2026-10-01", "2026-10-28") == []
