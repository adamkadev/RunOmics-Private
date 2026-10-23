import base64
import functools
import io
import json
import sys
import zipfile
from datetime import date

import httpx
import pytest

from diagnostics import probe_personal_api as probe

_KEY = "PERSONAL-KEY-NEVER-PRINTED"
_SENTINEL = "VALUE-NEVER-PRINTED"
_ACTIVITY_ID = 987654321
_PROFILE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


def _jwt(claims):
    body = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return f"header.{body}.signature"


_TOKEN = _jwt({"iat": 1_000_000, "exp": 1_000_000 + 24 * 3600, "scope": "activity:read health:read"})


def _zip_without_fit():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("activity.gpx", "<gpx/>")
    return buffer.getvalue()


def _handler(requests, *, sync_status=403, overrides=None):
    overrides = overrides or {}

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        path = request.url.path
        for prefix, response in overrides.items():
            if path.startswith(prefix):
                return response
        if path == probe.TOKEN_PATH:
            assert request.method == "POST"
            assert request.headers["Authorization"] == f"ApiKey {_KEY}"
            return httpx.Response(200, text=_TOKEN)

        assert request.method == "GET"
        assert request.headers["Authorization"] == f"Bearer {_TOKEN}"
        if path == "/activitylist-service/activities/search/activities":
            return httpx.Response(200, json=[{"activityId": _ACTIVITY_ID, "activityName": _SENTINEL}])
        if path.startswith("/download-service/"):
            if "application/x-zip-compressed" not in request.headers["Accept"]:
                return httpx.Response(406)
            return httpx.Response(200, content=_zip_without_fit())
        if path == "/userprofile-service/socialProfile":
            return httpx.Response(200, json={"displayName": _PROFILE_ID, "fullName": _SENTINEL})
        if path.startswith("/hrv-service/hrv/daily/"):
            return httpx.Response(204)
        documented = {
            p.path for p in probe.documented_probes(date(2026, 10, 21), date(2026, 10, 22), str(_ACTIVITY_ID))
        }
        if path in documented:
            return httpx.Response(
                200,
                json={"2026-10-21": {"v": _SENTINEL}, "123456": _SENTINEL, "calendarDate": _SENTINEL},
                headers={"X-RateLimit-Remaining": "99"},
            )
        return httpx.Response(sync_status, json={"message": _SENTINEL})

    return handle


@pytest.fixture
def run_cli(monkeypatch, capsys):
    monkeypatch.setattr(probe, "_PAUSE_SECONDS", 0)

    def run(handler, *, args=(), env=None):
        real_client = httpx.Client
        monkeypatch.setattr(probe.httpx, "Client", functools.partial(real_client, transport=httpx.MockTransport(handler)))
        monkeypatch.setattr(sys, "argv", ["probe_personal_api.py", "--as-of", "2026-10-22", *args])
        monkeypatch.delenv("GARMIN_SECRET", raising=False)
        monkeypatch.delenv(probe.BASE_URL_ENV, raising=False)
        for name, value in ({probe.KEY_ENV: _KEY} if env is None else env).items():
            monkeypatch.setenv(name, value)
        code = probe.main()
        captured = capsys.readouterr()
        return code, captured.out + captured.err

    return run


def test_missing_key_sends_nothing(run_cli, monkeypatch):
    monkeypatch.delenv(probe.KEY_ENV, raising=False)
    requests = []
    code, output = run_cli(_handler(requests), env={})

    assert code == 2
    assert requests == []
    assert probe.KEY_ENV in output


def test_compare_without_garmin_secret_sends_nothing(run_cli):
    requests = []
    code, _output = run_cli(_handler(requests), args=["--compare"])

    assert code == 2
    assert requests == []


def test_full_run_reports_shapes_and_never_a_value(run_cli):
    requests = []
    code, output = run_cli(_handler(requests))

    assert code == 0
    assert _KEY not in output
    assert _TOKEN not in output
    assert _SENTINEL not in output
    assert _PROFILE_ID not in output
    assert str(_ACTIVITY_ID) not in output
    # A date or numeric key is data, and is masked to one placeholder.
    assert "object {<id>, calendarDate}" in output
    assert "2026-10-21" not in output

    assert "valid 24.0 h" in output
    assert "Scopes: activity:read, health:read" in output
    assert "x-ratelimit-remaining=99" in output
    assert "ZIP without a .fit" in output
    assert "FIT file: the download holds no .fit" in output
    assert "Documented Personal API endpoints: 24/24 answered" in output
    assert "tried on the Personal API host: 1/22 answered" in output


def test_ids_from_earlier_answers_reach_later_paths(run_cli):
    requests = []
    run_cli(_handler(requests))
    paths = [r.url.path for r in requests]

    assert f"/activity-service/activity/{_ACTIVITY_ID}/hrTimeInZones" in paths
    assert f"/metrics-service/metrics/racepredictions/daily/{_PROFILE_ID}" in paths
    # Only the key exchange is not a GET.
    assert [r.method for r in requests].count("POST") == 1


def test_missing_ids_skip_their_probes_instead_of_calling_a_template(run_cli):
    requests = []
    code, output = run_cli(
        _handler(
            requests,
            overrides={
                "/activitylist-service/": httpx.Response(200, json=[]),
                "/userprofile-service/": httpx.Response(404),
            },
        )
    )

    assert code == 0
    assert not any("{" in str(r.url) or "%7B" in str(r.url) for r in requests)
    assert "skipped: no activity id" in output
    assert "skipped: no profile id" in output


def test_rate_limit_stops_the_run_and_prints_what_was_done(run_cli):
    requests = []
    code, output = run_cli(
        _handler(requests, overrides={"/hrv-service/hrv/2026": httpx.Response(429, headers={"Retry-After": "60"})})
    )

    assert code == 4
    assert "Stopped early: rate limited (429) at hrvNight" in output
    assert "retry-after=60" in output
    assert not any(r.url.path.startswith("/gear-service/") for r in requests)


def test_a_refused_token_stops_at_the_first_call(run_cli):
    requests = []
    code, output = run_cli(
        _handler(requests, overrides={"/activitylist-service/": httpx.Response(401, json={"message": _SENTINEL})})
    )

    assert code == 4
    assert len(requests) == 2
    assert _SENTINEL not in output


def test_a_failed_key_exchange_prints_only_its_status(run_cli):
    requests = []
    code, output = run_cli(
        _handler(requests, overrides={probe.TOKEN_PATH: httpx.Response(403, text=_SENTINEL)})
    )

    assert code == 3
    assert "HTTP 403" in output
    assert _SENTINEL not in output
    assert len(requests) == 1


def test_describe_keeps_shape_and_drops_values():
    assert probe.describe([]) == "list of 0"
    assert probe.describe([1, 2]) == "list of 2 int"
    assert probe.describe([{"b": 1, "a": 2}]) == "list of 1, rows {a, b}"
    assert probe.describe({"3f2b1c4d-0000-1111-2222-333333333333": 1, "x": 2}) == "object {<id>, x}"
    many = {f"k{i:02}": i for i in range(20)}
    assert probe.describe(many).endswith(", +5 more}")


class FakeConnectClient:
    def __init__(self, _secret):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def get_activity_detail(self, activity_id):
        assert activity_id == str(_ACTIVITY_ID)
        return {
            "activityId": _ACTIVITY_ID,
            "activityName": _SENTINEL,
            "description": _SENTINEL,
            "summaryDTO": {
                "startTimeLocal": "2026-10-21T07:00:00.0",
                "distance": 10_000.0,
                "duration": 3_000.0,
                "averageHR": 150.0,
            },
        }

    def download_fit(self, activity_id, *, strict_errors=False):
        return None


def test_compare_names_what_the_personal_api_lacks_and_no_value(monkeypatch):
    from garmin import client as garmin_client

    monkeypatch.setattr(garmin_client, "GarminClient", FakeConnectClient)
    detail = probe.Result(
        probe.Probe("activity", f"/activity-service/activity/{_ACTIVITY_ID}"),
        status=200,
        payload={
            "activityId": _ACTIVITY_ID,
            "activityName": _SENTINEL,
            "summaryDTO": {"startTimeLocal": "2026-10-21T07:00:00.0", "distance": 10_000.0},
        },
    )
    output = "\n".join(probe.compare_report([detail], "garth-secret"))

    assert "activity detail keys only on Connect: description" in output
    assert "summaryDTO keys only on Connect: averageHR, duration" in output
    assert "FIT: missing from the Personal API" in output
    assert "mapped fields lost on the Personal API:" in output
    assert "none" not in output.split("mapped fields lost on the Personal API:")[1]
    assert _SENTINEL not in output


def test_compare_reports_a_refused_mapping_and_carries_on(monkeypatch):
    from garmin import client as garmin_client

    monkeypatch.setattr(garmin_client, "GarminClient", FakeConnectClient)
    detail = probe.Result(
        probe.Probe("activity", f"/activity-service/activity/{_ACTIVITY_ID}"),
        status=200,
        payload={"activityId": _ACTIVITY_ID, "summaryDTO": {}},
    )
    output = "\n".join(probe.compare_report([detail], "garth-secret"))

    assert "the mapper refused the Personal API detail (ValueError)" in output
    assert "summaryDTO keys only on Connect" in output
    assert "mapped fields lost" not in output
