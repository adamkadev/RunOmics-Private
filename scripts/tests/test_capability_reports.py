import json
from pathlib import Path

import pytest

from diagnostics.compare_reports import (
    build_comparison,
    comparison_markdown,
    validate_comparison,
    write_comparison_bundle,
)
from diagnostics.model import FEATURE_IDS, ReportValidationError, load_report, validate_report

ROOT = Path(__file__).parents[2]
FIXTURE_DIR = ROOT / "fixtures" / "garmin"
FR55 = FIXTURE_DIR / "forerunner-55" / "capabilities.json"
FR255 = FIXTURE_DIR / "forerunner-255" / "capabilities.json"
REPORT_SCHEMA = ROOT / "scripts" / "diagnostics" / "capability-report.schema.json"

FORBIDDEN_KEYS = {
    "id",
    "userid",
    "deviceid",
    "activityid",
    "uuid",
    "serialnumber",
    "latitude",
    "longitude",
    "lat",
    "lon",
    "url",
    "email",
    "token",
    "secret",
    "payload",
}


@pytest.mark.parametrize("path", [FR55, FR255])
def test_committed_capability_fixtures_are_valid_and_sanitized(path):
    report = load_report(path)
    validate_report(report)
    _assert_no_forbidden_keys(report)

    serialized = path.read_text().lower()
    assert "http://" not in serialized
    assert "https://" not in serialized
    assert "@" not in serialized
    assert "coordinate" not in serialized


def test_fixtures_characterize_granular_fr55_fr255_differences():
    fr55 = load_report(FR55)
    fr255 = load_report(FR255)

    assert fr55["features"]["cadence"]["support"] == "observed"
    assert fr55["features"]["groundContactTime"]["support"] == "not_observed"
    assert fr255["features"]["cadence"]["support"] == "observed"
    assert fr255["features"]["groundContactTime"]["support"] == "observed"


def test_versioned_json_schema_matches_the_runtime_feature_allowlist():
    schema = json.loads(REPORT_SCHEMA.read_text())

    assert schema["properties"]["schemaVersion"]["const"] == 1
    feature_schema = schema["properties"]["features"]
    assert set(feature_schema["propertyNames"]["enum"]) == set(FEATURE_IDS)
    assert feature_schema["minProperties"] == len(FEATURE_IDS)
    assert feature_schema["maxProperties"] == len(FEATURE_IDS)


def test_comparison_contains_only_approved_fields():
    comparison = build_comparison(load_report(FR255), load_report(FR55))

    validate_comparison(comparison)
    assert set(comparison) == {"schemaVersion", "asOf", "devices", "features"}
    assert set(comparison["devices"]) == {"adam", "lamiaa"}
    assert set(comparison["features"]) == set(FEATURE_IDS)
    for profiles in comparison["features"].values():
        for state in profiles.values():
            assert set(state) == {"support", "probeStatus", "samples"}
    _assert_no_forbidden_keys(comparison)


def test_comparison_bundle_writes_reports_json_and_markdown(tmp_path):
    adam = load_report(FR255)
    lamiaa = load_report(FR55)

    write_comparison_bundle(tmp_path, adam, lamiaa)

    assert {path.name for path in tmp_path.iterdir()} == {
        "adam.json",
        "lamiaa.json",
        "comparison.json",
        "comparison.md",
    }
    assert load_report(tmp_path / "adam.json") == adam
    assert load_report(tmp_path / "lamiaa.json") == lamiaa
    comparison = json.loads((tmp_path / "comparison.json").read_text())
    validate_comparison(comparison)
    markdown = (tmp_path / "comparison.md").read_text()
    assert "not_observed" in markdown
    assert "does not mean unsupported" in markdown


def test_invalid_fixture_cannot_be_loaded(tmp_path):
    invalid = json.loads(FR55.read_text())
    invalid["accountUuid"] = "00000000-0000-0000-0000-000000000000"
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps(invalid))

    with pytest.raises(ReportValidationError):
        load_report(path)


def _assert_no_forbidden_keys(value):
    if isinstance(value, dict):
        for key, nested in value.items():
            assert key.lower() not in FORBIDDEN_KEYS
            _assert_no_forbidden_keys(nested)
    elif isinstance(value, list):
        for nested in value:
            _assert_no_forbidden_keys(nested)
