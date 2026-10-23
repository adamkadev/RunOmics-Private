from __future__ import annotations

from typing import Any

from garmin_fit_sdk import Decoder, Stream

from diagnostics.model import InvalidProbePayload
from processing.fit_parser import parse_fit

FIT_FEATURE_IDS = (
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

_GROUND_CONTACT_BALANCE_FIELDS = {
    "stance_time_balance",
    "avg_stance_time_balance",
    "left_right_balance",
}
_POWER_FIELDS = {
    "power",
    "avg_power",
    "max_power",
    "normalized_power",
    "enhanced_avg_power",
    "enhanced_max_power",
}


def inspect_fit_capabilities(content: bytes) -> set[str]:
    """Return only allowlisted feature names; never expose decoded FIT values."""
    if not content:
        raise InvalidProbePayload("empty FIT file")

    parsed = parse_fit(content)
    if not parsed.has_data:
        raise InvalidProbePayload("FIT file could not be decoded")

    features: set[str] = set()
    if parsed.heart_rates or parsed.avg_heart_rate is not None:
        features.add("activityHeartRate")
    if parsed.cadence_spm is not None or parsed.cadence_samples:
        features.add("cadence")
    if parsed.calories is not None:
        features.add("calories")
    if parsed.route:
        features.add("gps")
    if parsed.elevation_samples or parsed.elevation_gain_m > 0:
        features.add("elevation")
    if parsed.avg_temperature is not None:
        features.add("temperature")
    if parsed.stride_length_m is not None:
        features.add("strideLength")
    if parsed.ground_contact_ms is not None:
        features.add("groundContactTime")
    if parsed.vertical_oscillation_mm is not None:
        features.add("verticalOscillation")
    if parsed.vertical_ratio_pct is not None:
        features.add("verticalRatio")
    if parsed.aer_training_effect is not None:
        features.add("aerobicTrainingEffect")
    if parsed.ana_training_effect is not None:
        features.add("anaerobicTrainingEffect")

    # Only these fields' allowlisted names are checked; the decoded messages are discarded.
    messages = _decode_messages(content)
    if _contains_field(messages, _GROUND_CONTACT_BALANCE_FIELDS):
        features.add("groundContactBalance")
    if _contains_field(messages, _POWER_FIELDS):
        features.add("runningPower")
    return features


def _decode_messages(content: bytes) -> dict[str, Any]:
    try:
        messages, _errors = Decoder(Stream.from_byte_array(bytearray(content))).read()
    except Exception as exc:
        raise InvalidProbePayload("FIT file could not be decoded") from exc
    if not isinstance(messages, dict):
        raise InvalidProbePayload("FIT decoder returned an invalid shape")
    return messages


def _contains_field(messages: dict[str, Any], names: set[str]) -> bool:
    for rows in messages.values():
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            if any(name in row and row[name] is not None for name in names):
                return True
    return False
