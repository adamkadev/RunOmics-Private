import json
import sys
from datetime import date

import pytest

from diagnostics import probe_garmin_capabilities as probe
from diagnostics.model import validate_report
from garmin.client import GarminAPIError, GarminAuthError


class FakeClient:
    def __init__(self):
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def get_primary_training_device(self):
        self.calls.append(("device",))
        return {
            "PrimaryTrainingDevice": {"deviceId": 999999},
            "RegisteredDevices": [
                {
                    "deviceId": 999999,
                    "displayName": "Forerunner Test",
                    "currentFirmwareVersion": "1.23",
                    "serialNumber": "SECRET-SERIAL",
                    "uuid": "00000000-0000-0000-0000-000000000000",
                    "primary": True,
                }
            ],
        }

    def get_user_settings(self):
        self.calls.append(("user_settings",))
        return {
            "userData": {
                "vo2MaxRunning": 42.0,
                "lactateThresholdHeartRate": None,
                "lactateThresholdSpeed": None,
                "weight": 60000,
                "height": 170,
                "email": "private@example.test",
            }
        }

    def get_heart_rate_zones(self):
        self.calls.append(("heart_rate_zones",))
        return [
            {
                "sport": "RUNNING",
                "zone1Floor": 100,
                "zone2Floor": 120,
                "zone3Floor": 140,
                "zone4Floor": 160,
                "zone5Floor": 180,
                "restingHeartRateUsed": 50,
                "maxHeartRateUsed": 200,
                "deviceId": 999999,
            }
        ]

    def get_fitness_age(self, start, end):
        self.calls.append(("fitness_age", start, end))
        return []

    def get_max_met_monthly(self, start, end):
        self.calls.append(("maxmet_monthly", start, end))
        return []

    def get_max_met_daily(self, start, end):
        self.calls.append(("maxmet_daily", start, end))
        return []

    def get_biometric_stat(self, metric, start, end):
        self.calls.append(("biometric", metric, start, end))
        return []

    def get_training_status_daily(self, start, end):
        self.calls.append(("training_daily", start, end))
        return {"reportData": {}}

    def get_profile_uuid(self):
        self.calls.append(("profile_prerequisite",))
        return "private-profile-value"

    def get_training_status_weekly(self, start, end):
        self.calls.append(("training_weekly", start, end))
        return {"reportData": {}}

    def get_training_load_balance(self, day):
        self.calls.append(("load_balance", day))
        return {"metricsTrainingLoadBalanceDTOMap": {}}

    def get_race_predictions(self, start, end):
        self.calls.append(("race_predictions", start, end))
        return []

    def get_gear_list(self, status):
        self.calls.append(("gear", status))
        return []

    def get_training_plans(self):
        self.calls.append(("training_plans",))
        return {"trainingPlanList": []}

    def get_calendar_month(self, year, month):
        self.calls.append(("calendar", year, month))
        return {"calendarItems": []}

    def get_activities(self, start, limit, *, running_only):
        self.calls.append(("activities", start, limit, running_only))
        return []


def test_probe_plan_is_identical_and_uses_fixed_ranges_for_both_profiles():
    first = FakeClient()
    second = FakeClient()
    as_of = date(2026, 8, 28)

    report_a = probe.ProbeRunner(first, as_of=as_of, sleep=lambda _seconds: None).run()
    report_b = probe.ProbeRunner(second, as_of=as_of, sleep=lambda _seconds: None).run()

    assert first.calls == second.calls
    assert ("fitness_age", "2025-08-29", "2026-08-28") in first.calls
    assert ("maxmet_monthly", "2025-08-29", "2026-08-28") in first.calls
    assert ("maxmet_daily", "2026-07-25", "2026-08-28") in first.calls
    assert (
        "biometric",
        "lactateThresholdHeartRate",
        "2025-08-29",
        "2026-08-28",
    ) in first.calls
    assert ("training_daily", "2026-08-01", "2026-08-28") in first.calls
    assert ("training_weekly", "2026-02-28", "2026-08-28") in first.calls
    assert ("race_predictions", "2026-05-01", "2026-08-28") in first.calls
    assert [(call[1], call[2]) for call in first.calls if call[0] == "calendar"] == [
        (2026, 8),
        (2026, 9),
        (2026, 10),
        (2026, 11),
    ]
    assert ("activities", 0, 20, True) in first.calls
    assert report_a["device"] == {"name": "Forerunner Test", "firmware": "1.23"}
    assert report_a["features"] == report_b["features"]
    validate_report(report_a)

    serialized = json.dumps(report_a)
    assert "999999" not in serialized
    assert "SECRET-SERIAL" not in serialized
    assert "00000000-0000-0000-0000-000000000000" not in serialized
    assert "private@example.test" not in serialized


def test_no_activities_classifies_fit_features_as_not_observed():
    report = probe.ProbeRunner(
        FakeClient(), as_of=date(2026, 8, 28), sleep=lambda _seconds: None
    ).run()

    for feature in (*probe.FIT_FEATURE_IDS, "activityHeartRateZones"):
        assert report["features"][feature]["support"] == "not_observed"
        assert report["features"][feature]["probeStatus"] == "ok"


@pytest.mark.parametrize(
    "status_code,expected_support,expected_probe",
    [
        (404, "unsupported", "unsupported"),
        (410, "unsupported", "unsupported"),
        (403, "unknown", "invalid_response"),
        (422, "unknown", "invalid_response"),
        (429, "unknown", "temporary_error"),
        (503, "unknown", "temporary_error"),
    ],
)
def test_http_errors_have_safe_capability_classification(
    status_code, expected_support, expected_probe
):
    client = FakeClient()
    sensitive = (
        "https://example.test/profile/00000000-0000-0000-0000-000000000000"
        "?token=SECRET&serial=PRIVATE-SERIAL&coordinates=48.0,7.0"
    )

    def fail(_day):
        raise GarminAPIError(status_code, sensitive)

    client.get_training_load_balance = fail
    logs = []
    report = probe.ProbeRunner(
        client,
        as_of=date(2026, 8, 28),
        sleep=lambda _seconds: None,
        log=logs.append,
    ).run()

    state = report["features"]["trainingLoadBalance"]
    assert state["support"] == expected_support
    assert state["probeStatus"] == expected_probe
    output = json.dumps(report) + "\n".join(logs)
    assert "00000000-0000-0000-0000-000000000000" not in output
    assert "SECRET" not in output
    assert "https://" not in output
    assert "PRIVATE-SERIAL" not in output
    assert "48.0,7.0" not in output


def test_activity_specific_404_is_unknown_not_unsupported(monkeypatch):
    client = FakeClient()
    client.get_activities = lambda *_args, **_kwargs: [
        {"activityId": "private-activity", "startTimeLocal": "2026-08-20 07:00:00"}
    ]
    client.download_fit = lambda *_args, **_kwargs: (_ for _ in ()).throw(
        GarminAPIError(404, "https://example.test/private-activity")
    )
    client.get_hr_zones = lambda *_args, **_kwargs: (_ for _ in ()).throw(
        GarminAPIError(404, "https://example.test/private-activity")
    )

    report = probe.ProbeRunner(
        client, as_of=date(2026, 8, 28), sleep=lambda _seconds: None
    ).run()

    assert report["features"]["cadence"]["support"] == "unknown"
    assert report["features"]["cadence"]["probeStatus"] == "invalid_response"
    assert report["features"]["activityHeartRateZones"]["support"] == "unknown"


def test_profile_prerequisite_404_does_not_mark_stable_features_unsupported():
    client = FakeClient()
    client.get_profile_uuid = lambda: (_ for _ in ()).throw(
        GarminAPIError(404, "https://example.test/private-profile")
    )

    report = probe.ProbeRunner(
        client, as_of=date(2026, 8, 28), sleep=lambda _seconds: None
    ).run()

    for feature in (
        "trainingStatus",
        "trainingStatusWeekly",
        "acuteTrainingLoad",
        "chronicTrainingLoad",
        "acwr",
        "racePredictions",
    ):
        assert report["features"][feature]["support"] == "unknown"
        assert report["features"][feature]["probeStatus"] == "invalid_response"


def test_mixed_fit_success_and_transient_failure_preserves_observed_metrics(monkeypatch):
    client = FakeClient()
    client.get_activities = lambda *_args, **_kwargs: [
        {"activityId": "one", "startTimeLocal": "2026-08-18 07:00:00"},
        {"activityId": "two", "startTimeLocal": "2026-08-19 07:00:00"},
        {"activityId": "three", "startTimeLocal": "2026-08-20 07:00:00"},
    ]

    def download(activity_id, *, strict_errors):
        assert strict_errors is True
        if activity_id == "two":
            raise GarminAPIError(503, "https://example.test/private-activity")
        return b"safe synthetic bytes"

    client.download_fit = download
    client.get_hr_zones = lambda *_args, **_kwargs: []
    monkeypatch.setattr(
        probe,
        "inspect_fit_capabilities",
        lambda _content: {"activityHeartRate", "cadence"},
    )

    report = probe.ProbeRunner(
        client,
        as_of=date(2026, 8, 28),
        sleep=lambda _seconds: None,
        log=lambda _message: None,
    ).run()

    assert report["features"]["activityHeartRate"] == {
        "support": "observed",
        "probeStatus": "temporary_error",
        "samples": 2,
        "firstSampleAt": "2026-08-18",
        "lastSampleAt": "2026-08-20",
    }
    assert report["features"]["cadence"]["support"] == "observed"
    assert report["features"]["calories"]["support"] == "not_observed"
    assert report["features"]["calories"]["probeStatus"] == "temporary_error"


@pytest.mark.parametrize(
    "network_error",
    [
        probe.httpx.ConnectError("private URL and token must not escape"),
        probe.httpx.ReadTimeout("private URL and token must not escape"),
    ],
)
def test_network_failure_is_temporary_error(network_error):
    client = FakeClient()
    client.get_training_load_balance = lambda _day: (_ for _ in ()).throw(
        network_error
    )

    report = probe.ProbeRunner(
        client,
        as_of=date(2026, 8, 28),
        sleep=lambda _seconds: None,
        log=lambda _message: None,
    ).run()

    assert report["features"]["trainingLoadBalance"]["probeStatus"] == "temporary_error"


def test_malformed_partial_response_is_unknown_and_invalid():
    client = FakeClient()
    client.get_training_plans = lambda: {"unexpected": []}

    report = probe.ProbeRunner(
        client, as_of=date(2026, 8, 28), sleep=lambda _seconds: None
    ).run()

    assert report["features"]["trainingPlan"] == {
        "support": "unknown",
        "probeStatus": "invalid_response",
        "samples": 0,
    }


def test_missing_secret_writes_no_report(tmp_path, monkeypatch, capsys):
    output = tmp_path / "report.json"
    monkeypatch.delenv("GARMIN_SECRET", raising=False)
    monkeypatch.setattr(sys, "argv", ["probe", "--output", str(output)])

    assert probe.main() == 2
    assert not output.exists()
    assert "GARMIN_SECRET is not set" in capsys.readouterr().err


def test_invalid_secret_writes_no_report_and_never_echoes_exception(
    tmp_path, monkeypatch, capsys
):
    output = tmp_path / "report.json"
    secret = "TOP-SECRET-TOKEN"
    sensitive_error = (
        "invalid token at https://example.test/00000000-0000-0000-0000-000000000000 "
        "serial=PRIVATE coordinates=48.0,7.0"
    )

    class InvalidClient:
        def __init__(self, _secret):
            raise GarminAuthError(sensitive_error)

    monkeypatch.setenv("GARMIN_SECRET", secret)
    monkeypatch.setattr(probe, "GarminClient", InvalidClient)
    monkeypatch.setattr(sys, "argv", ["probe", "--output", str(output)])

    assert probe.main() == 3
    assert not output.exists()
    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert "authentication failed" in combined
    assert secret not in combined
    assert "00000000-0000-0000-0000-000000000000" not in combined
    assert "https://" not in combined
    assert "48.0" not in combined


def test_401_during_probe_aborts_without_report(tmp_path, monkeypatch, capsys):
    output = tmp_path / "report.json"
    client = FakeClient()
    client.get_user_settings = lambda: (_ for _ in ()).throw(
        GarminAPIError(
            401,
            "https://example.test/00000000-0000-0000-0000-000000000000?token=SECRET",
        )
    )

    monkeypatch.setenv("GARMIN_SECRET", "TOP-SECRET-TOKEN")
    monkeypatch.setattr(probe, "GarminClient", lambda _secret: client)
    monkeypatch.setattr(sys, "argv", ["probe", "--output", str(output)])

    assert probe.main() == 3
    assert not output.exists()
    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert "https://" not in combined
    assert "SECRET" not in combined


def test_successful_cli_writes_atomic_sanitized_report_and_safe_summary(
    tmp_path, monkeypatch, capsys
):
    output = tmp_path / "report.json"
    client = FakeClient()

    monkeypatch.setenv("GARMIN_SECRET", "TOP-SECRET-TOKEN")
    monkeypatch.setattr(probe, "GarminClient", lambda _secret: client)
    monkeypatch.setattr(
        sys,
        "argv",
        ["probe", "--as-of", "2026-08-28", "--output", str(output)],
    )

    assert probe.main() == 0
    report = json.loads(output.read_text())
    validate_report(report)
    stdout = capsys.readouterr().out
    assert "vo2max: observed; probe=ok; samples=" in stdout
    assert "TOP-SECRET-TOKEN" not in stdout
    assert "SECRET-SERIAL" not in stdout
