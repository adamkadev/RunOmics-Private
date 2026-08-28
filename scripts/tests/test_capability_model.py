from datetime import date, datetime, timezone

import pytest

from diagnostics.model import (
    FEATURE_IDS,
    FeatureAccumulator,
    ReportValidationError,
    SampleSummary,
    build_report,
    empty_accumulators,
    validate_report,
)


def test_populated_success_is_observed():
    feature = FeatureAccumulator()
    feature.success(SampleSummary(3, "2026-08-01", "2026-08-03"))

    assert feature.finish() == {
        "support": "observed",
        "probeStatus": "ok",
        "samples": 3,
        "firstSampleAt": "2026-08-01",
        "lastSampleAt": "2026-08-03",
    }


def test_empty_success_is_not_observed_not_unsupported():
    feature = FeatureAccumulator()
    feature.success(0)

    result = feature.finish()

    assert result["support"] == "not_observed"
    assert result["probeStatus"] == "ok"
    assert result["samples"] == 0


@pytest.mark.parametrize("status_code", [404, 410])
def test_genuine_unsupported_outcome_is_unsupported(status_code):
    feature = FeatureAccumulator()
    feature.failure("unsupported")

    assert feature.finish() == {
        "support": "unsupported",
        "probeStatus": "unsupported",
        "samples": 0,
    }


def test_unexpected_client_or_malformed_response_stays_unknown():
    feature = FeatureAccumulator()
    feature.failure("invalid_response")

    assert feature.finish() == {
        "support": "unknown",
        "probeStatus": "invalid_response",
        "samples": 0,
    }


def test_transient_error_without_prior_evidence_is_unknown():
    feature = FeatureAccumulator()
    feature.failure("temporary_error")

    assert feature.finish() == {
        "support": "unknown",
        "probeStatus": "temporary_error",
        "samples": 0,
    }


def test_transient_error_preserves_prior_observed_support():
    feature = FeatureAccumulator()
    feature.failure("temporary_error")
    previous = {
        "support": "observed",
        "probeStatus": "ok",
        "samples": 7,
        "firstSampleAt": "2026-07-01",
        "lastSampleAt": "2026-07-20",
    }

    assert feature.finish(previous) == {
        "support": "observed",
        "probeStatus": "temporary_error",
        "samples": 7,
        "firstSampleAt": "2026-07-01",
        "lastSampleAt": "2026-07-20",
        "preservedPriorSupport": True,
    }


def test_observation_in_same_run_survives_later_transient_failure():
    feature = FeatureAccumulator()
    feature.success(2)
    feature.failure("temporary_error")

    result = feature.finish()

    assert result["support"] == "observed"
    assert result["samples"] == 2
    assert result["probeStatus"] == "temporary_error"


def test_partial_empty_evidence_does_not_downgrade_prior_support_during_transient_error():
    feature = FeatureAccumulator()
    feature.success(0)
    feature.failure("temporary_error")

    result = feature.finish({"support": "observed", "probeStatus": "ok", "samples": 4})

    assert result["support"] == "observed"
    assert result["samples"] == 4
    assert result["preservedPriorSupport"] is True


def test_report_schema_rejects_unknown_nested_fields():
    report = build_report(
        as_of=date(2026, 8, 28),
        device={"name": "Forerunner Test"},
        accumulators=empty_accumulators(),
        generated_at=datetime(2026, 8, 28, tzinfo=timezone.utc),
    )
    report["features"][FEATURE_IDS[0]]["deviceId"] = 123

    with pytest.raises(ReportValidationError):
        validate_report(report)


def test_report_schema_rejects_unsafe_device_text():
    report = build_report(
        as_of=date(2026, 8, 28),
        device={},
        accumulators=empty_accumulators(),
        generated_at=datetime(2026, 8, 28, tzinfo=timezone.utc),
    )
    report["device"] = {"name": "https://example.test/profile/private"}

    with pytest.raises(ReportValidationError):
        validate_report(report)


@pytest.mark.parametrize(
    "unsafe_label",
    [
        "00000000-0000-4000-8000-000000000000",
        "serial PRIVATE-SERIAL",
        "48.8566, 2.3522",
    ],
)
def test_report_schema_rejects_identifier_shaped_device_labels(unsafe_label):
    report = build_report(
        as_of=date(2026, 8, 28),
        device={},
        accumulators=empty_accumulators(),
        generated_at=datetime(2026, 8, 28, tzinfo=timezone.utc),
    )
    report["device"] = {"name": unsafe_label}

    with pytest.raises(ReportValidationError):
        validate_report(report)


def test_report_schema_rejects_boolean_sample_count():
    report = build_report(
        as_of=date(2026, 8, 28),
        device={},
        accumulators=empty_accumulators(),
        generated_at=datetime(2026, 8, 28, tzinfo=timezone.utc),
    )
    report["features"][FEATURE_IDS[0]]["samples"] = False

    with pytest.raises(ReportValidationError):
        validate_report(report)
