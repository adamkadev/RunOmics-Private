from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import TYPE_CHECKING, Any
from collections.abc import Sequence

if TYPE_CHECKING:
    from processing.fit_parser import ParsedFit


_PRIMARY_BENEFIT_TYPES: dict[int, str] = {
    1: "Base",
    2: "Base",
    3: "Tempo",
    4: "Threshold",
    5: "VO2Max",
    6: "Anaerobic",
    7: "Sprint",
}


@dataclass(frozen=True)
class TypeInference:
    activity_type: str
    source: str


def infer_type_with_source(
    name: str,
    parsed: ParsedFit | None,
    *,
    hr_zones: Sequence[Any] = (),
    duration_seconds: int | None = None,
) -> TypeInference:
    del name  # Names are intentionally not used as device/profile-specific hints.

    if parsed and parsed.is_race:
        return TypeInference("Race", "garmin")

    if parsed and parsed.primary_benefit in _PRIMARY_BENEFIT_TYPES:
        return TypeInference(_PRIMARY_BENEFIT_TYPES[parsed.primary_benefit], "garmin")

    inferred = _infer_runomics_type(
        parsed,
        hr_zones=hr_zones,
        duration_seconds=duration_seconds,
    )
    return TypeInference(inferred, "runomics")


def infer_type(
    name: str,
    parsed: ParsedFit | None,
    *,
    hr_zones: Sequence[Any] = (),
    duration_seconds: int | None = None,
) -> str:
    return infer_type_with_source(
        name,
        parsed,
        hr_zones=hr_zones,
        duration_seconds=duration_seconds,
    ).activity_type


def _infer_runomics_type(
    parsed: ParsedFit | None,
    *,
    hr_zones: Sequence[Any],
    duration_seconds: int | None,
) -> str:
    active_durations, recovery_seconds = _interval_evidence(parsed)
    if active_durations:
        typical_effort = median(active_durations)
        active_seconds = sum(active_durations)
        recovery_ratio = recovery_seconds / active_seconds if active_seconds else 0.0
        repetitions = len(active_durations)

        if repetitions >= 4 and typical_effort <= 45 and recovery_ratio >= 0.6:
            return "Sprint"
        if repetitions >= 3 and typical_effort <= 120 and recovery_ratio >= 0.4:
            return "Anaerobic"
        if repetitions >= 3 and 120 < typical_effort <= 360 and recovery_ratio >= 0.2:
            return "VO2Max"
        if repetitions >= 2 and 360 < typical_effort <= 1_200:
            return "Threshold"

    duration = duration_seconds or (parsed.duration_seconds if parsed else 0)
    if duration >= 20 * 60:
        z3 = _zone_share(hr_zones, 3)
        z4 = _zone_share(hr_zones, 4)
        z5 = _zone_share(hr_zones, 5)
        high = z4 + z5

        if z5 >= 20:
            return "VO2Max"
        if z4 >= 20 and high >= 35:
            return "Threshold"
        if z3 >= 35 and high < 30:
            return "Tempo"

    # Missing or ambiguous evidence stays Base: this never fabricates a Training Effect.
    return "Base"


def _interval_evidence(parsed: ParsedFit | None) -> tuple[list[int], int]:
    if not parsed or not parsed.splits:
        return [], 0

    active: list[int] = []
    recovery = 0
    for split in parsed.splits:
        if split.type == "interval_active":
            laps = [lap.duration_sec for lap in split.laps if lap.duration_sec > 0]
            if len(laps) >= 2:
                active.extend(laps)
            elif split.duration_sec > 0:
                active.append(split.duration_sec)
        elif split.type in ("interval_rest", "interval_recovery"):
            recovery += max(0, split.duration_sec)
    return active, recovery


def _zone_share(hr_zones: Sequence[Any], zone_number: int) -> float:
    for zone in hr_zones:
        if isinstance(zone, dict):
            number = zone.get("zone")
            percent = zone.get("percent")
        else:
            number = getattr(zone, "zone", None)
            percent = getattr(zone, "percent", None)
        if number == zone_number and isinstance(percent, (int, float)):
            return max(0.0, float(percent))
    return 0.0
