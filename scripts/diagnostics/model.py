from __future__ import annotations

import json
import os
import re
import tempfile
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Literal
from collections.abc import Iterable

SCHEMA_VERSION = 1

CapabilitySupport = Literal["observed", "not_observed", "unsupported", "unknown"]
ProbeStatus = Literal[
    "ok",
    "temporary_error",
    "unsupported",
    "auth_error",
    "invalid_response",
]

SUPPORT_VALUES = {"observed", "not_observed", "unsupported", "unknown"}
PROBE_STATUS_VALUES = {
    "ok",
    "temporary_error",
    "unsupported",
    "auth_error",
    "invalid_response",
}

# Granular IDs are intentional: one running-dynamics field being present must
# never make every field in that family look supported.
FEATURE_IDS = (
    "vo2max",
    "fitnessAge",
    "achievableFitnessAge",
    "bmi",
    "weight",
    "height",
    "heartRateZones",
    "activityHeartRateZones",
    "restingHeartRate",
    "maxHeartRate",
    "lactateThresholdHeartRate",
    "thresholdPace",
    "racePredictions",
    "trainingStatus",
    "trainingStatusWeekly",
    "acuteTrainingLoad",
    "chronicTrainingLoad",
    "acwr",
    "trainingLoadBalance",
    "activeGear",
    "retiredGear",
    "trainingPlan",
    "plannedWorkouts",
    "upcomingRaces",
    "activityHeartRate",
    "cadence",
    "calories",
    "gps",
    "elevation",
    "temperature",
    "strideLength",
    "groundContactTime",
    "groundContactBalance",
    "verticalOscillation",
    "verticalRatio",
    "aerobicTrainingEffect",
    "anaerobicTrainingEffect",
    "runningPower",
)
FEATURE_ID_SET = set(FEATURE_IDS)

_TOP_LEVEL_KEYS = {"schemaVersion", "generatedAt", "asOf", "device", "features"}
_DEVICE_KEYS = {"name", "firmware"}
_FEATURE_KEYS = {
    "support",
    "probeStatus",
    "samples",
    "firstSampleAt",
    "lastSampleAt",
    "preservedPriorSupport",
}
_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_ISO_DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T[^\s]+$")
_UNSAFE_TEXT_RE = re.compile(r"(?:https?://|@|\r|\n)", re.IGNORECASE)
_UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
_COORDINATE_PAIR_RE = re.compile(r"[-+]?\d{1,3}\.\d+\s*[,;]\s*[-+]?\d{1,3}\.\d+")
_SENSITIVE_LABEL_RE = re.compile(
    r"\b(?:account|profile|secret|serial|token|uuid|latitude|longitude|coordinates?)\b",
    re.IGNORECASE,
)


class ReportValidationError(ValueError):
    """The would-be persisted report is outside the privacy allowlist."""


class DiagnosticAuthError(RuntimeError):
    """Authentication failed; no feature report should be produced."""


class InvalidProbePayload(ValueError):
    """An endpoint returned a shape the diagnostic cannot safely interpret."""


@dataclass(frozen=True)
class SampleSummary:
    samples: int
    first_sample_at: str | None = None
    last_sample_at: str | None = None

    def __post_init__(self) -> None:
        if self.samples < 0:
            raise ValueError("samples must be non-negative")


@dataclass(frozen=True)
class ProbeFailure:
    status: ProbeStatus


@dataclass
class FeatureAccumulator:
    """Combines independent observations without letting an error erase evidence."""

    successes: list[SampleSummary] = field(default_factory=list)
    failures: list[ProbeFailure] = field(default_factory=list)

    def success(self, summary: SampleSummary | int) -> None:
        self.successes.append(summary if isinstance(summary, SampleSummary) else SampleSummary(summary))

    def failure(self, status: ProbeStatus) -> None:
        if status == "auth_error":
            raise DiagnosticAuthError("Garmin authentication failed")
        self.failures.append(ProbeFailure(status))

    def finish(self, previous: dict[str, Any] | None = None) -> dict[str, Any]:
        samples = sum(item.samples for item in self.successes)
        dated = [item for item in self.successes if item.first_sample_at or item.last_sample_at]

        if samples > 0:
            support: CapabilitySupport = "observed"
        elif self.successes:
            # A valid empty response only means nothing was observed in this window, never unsupported.
            support = "not_observed"
        elif any(item.status == "unsupported" for item in self.failures):
            support = "unsupported"
        else:
            support = "unknown"

        if any(item.status == "temporary_error" for item in self.failures):
            probe_status: ProbeStatus = "temporary_error"
        elif any(item.status == "invalid_response" for item in self.failures):
            probe_status = "invalid_response"
        elif support == "unsupported":
            probe_status = "unsupported"
        else:
            probe_status = "ok"

        preserved = False
        if samples == 0 and probe_status == "temporary_error" and previous:
            previous_support = previous.get("support")
            if previous_support in SUPPORT_VALUES and previous_support != "unknown":
                support = previous_support
                samples = _safe_nonnegative_int(previous.get("samples"))
                preserved = True

        result: dict[str, Any] = {
            "support": support,
            "probeStatus": probe_status,
            "samples": samples,
        }

        first_dates = [item.first_sample_at for item in dated if item.first_sample_at]
        last_dates = [item.last_sample_at for item in dated if item.last_sample_at]
        if first_dates:
            result["firstSampleAt"] = min(first_dates)
        elif preserved and previous and previous.get("firstSampleAt"):
            result["firstSampleAt"] = previous["firstSampleAt"]
        if last_dates:
            result["lastSampleAt"] = max(last_dates)
        elif preserved and previous and previous.get("lastSampleAt"):
            result["lastSampleAt"] = previous["lastSampleAt"]
        if preserved:
            result["preservedPriorSupport"] = True
        return result


def _safe_nonnegative_int(value: Any) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def empty_accumulators() -> dict[str, FeatureAccumulator]:
    return {feature: FeatureAccumulator() for feature in FEATURE_IDS}


def build_report(
    *,
    as_of: date,
    device: dict[str, str],
    accumulators: dict[str, FeatureAccumulator],
    previous_report: dict[str, Any] | None = None,
    generated_at: datetime | None = None,
) -> dict[str, Any]:
    previous_features = (previous_report or {}).get("features") or {}
    report = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": (generated_at or datetime.now(timezone.utc)).isoformat(),
        "asOf": as_of.isoformat(),
        "device": {key: value for key, value in device.items() if key in _DEVICE_KEYS and value},
        "features": {
            feature: accumulators[feature].finish(previous_features.get(feature))
            for feature in FEATURE_IDS
        },
    }
    validate_report(report)
    return report


def validate_report(report: Any) -> None:
    if not isinstance(report, dict):
        raise ReportValidationError("report must be an object")
    _require_exact_or_subset_keys(report, _TOP_LEVEL_KEYS, required=_TOP_LEVEL_KEYS, where="report")
    if report.get("schemaVersion") != SCHEMA_VERSION:
        raise ReportValidationError("unsupported schemaVersion")
    _validate_date(report.get("asOf"), "asOf")
    generated_at = report.get("generatedAt")
    if not isinstance(generated_at, str) or not _ISO_DATETIME_RE.match(generated_at):
        raise ReportValidationError("generatedAt must be an ISO timestamp")
    try:
        parsed_generated_at = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ReportValidationError("generatedAt must be an ISO timestamp") from exc
    if parsed_generated_at.tzinfo is None:
        raise ReportValidationError("generatedAt must include a timezone")

    device = report.get("device")
    if not isinstance(device, dict):
        raise ReportValidationError("device must be an object")
    _require_exact_or_subset_keys(device, _DEVICE_KEYS, required=set(), where="device")
    for key, value in device.items():
        _validate_safe_label(value, f"device.{key}")

    features = report.get("features")
    if not isinstance(features, dict) or set(features) != FEATURE_ID_SET:
        raise ReportValidationError("features must contain the complete allowlisted feature set")
    for feature, state in features.items():
        if feature not in FEATURE_ID_SET or not isinstance(state, dict):
            raise ReportValidationError("invalid feature entry")
        _require_exact_or_subset_keys(
            state,
            _FEATURE_KEYS,
            required={"support", "probeStatus", "samples"},
            where=f"features.{feature}",
        )
        if state["support"] not in SUPPORT_VALUES:
            raise ReportValidationError(f"invalid support for {feature}")
        if state["probeStatus"] not in PROBE_STATUS_VALUES:
            raise ReportValidationError(f"invalid probeStatus for {feature}")
        if (
            not isinstance(state["samples"], int)
            or isinstance(state["samples"], bool)
            or state["samples"] < 0
        ):
            raise ReportValidationError(f"invalid sample count for {feature}")
        for key in ("firstSampleAt", "lastSampleAt"):
            if key in state:
                _validate_date(state[key], f"features.{feature}.{key}")
        if "preservedPriorSupport" in state and state["preservedPriorSupport"] is not True:
            raise ReportValidationError("preservedPriorSupport can only be true")


def _require_exact_or_subset_keys(
    value: dict[str, Any], allowed: set[str], *, required: set[str], where: str
) -> None:
    keys = set(value)
    unknown = keys - allowed
    missing = required - keys
    if unknown or missing:
        raise ReportValidationError(f"{where} has unknown or missing fields")


def _validate_date(value: Any, where: str) -> None:
    if not isinstance(value, str) or not _ISO_DATE_RE.match(value):
        raise ReportValidationError(f"{where} must be an ISO date")
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise ReportValidationError(f"{where} must be a real calendar date") from exc


def _validate_safe_label(value: Any, where: str) -> None:
    if (
        not isinstance(value, str)
        or not value
        or len(value) > 80
        or _UNSAFE_TEXT_RE.search(value)
        or _UUID_RE.search(value)
        or _COORDINATE_PAIR_RE.search(value)
        or _SENSITIVE_LABEL_RE.search(value)
    ):
        raise ReportValidationError(f"{where} is not a safe display label")


def load_report(path: Path) -> dict[str, Any]:
    report = json.loads(path.read_text())
    validate_report(report)
    return report


def write_report_atomic(path: Path, report: dict[str, Any]) -> None:
    validate_report(report)
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(report, indent=2, sort_keys=True) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False
    ) as handle:
        temp_path = Path(handle.name)
        handle.write(serialized)
        handle.flush()
        os.fsync(handle.fileno())
    try:
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def sample_summary(dates: Iterable[str]) -> SampleSummary:
    safe_dates = sorted({value[:10] for value in dates if isinstance(value, str) and _ISO_DATE_RE.match(value[:10])})
    return SampleSummary(
        samples=len(safe_dates),
        first_sample_at=safe_dates[0] if safe_dates else None,
        last_sample_at=safe_dates[-1] if safe_dates else None,
    )
