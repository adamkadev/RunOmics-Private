from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from processing.fit_parser import ParsedFit

_NAME_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\btempo\b", re.I), "Tempo"),
]

_PRIMARY_BENEFIT_TYPES: dict[int, str] = {
    1: "Base",
    2: "Base",
    3: "Tempo",
    4: "Threshold",
    5: "VO2Max",
    6: "Anaerobic",
    7: "Sprint",
}


def infer_type(name: str, parsed: "ParsedFit | None") -> str:
    if parsed and parsed.is_race:
        return "Race"

    if parsed and parsed.primary_benefit in _PRIMARY_BENEFIT_TYPES:
        return _PRIMARY_BENEFIT_TYPES[parsed.primary_benefit]

    for pattern, activity_type in _NAME_PATTERNS:
        if pattern.search(name):
            return activity_type

    if parsed is not None and (
        parsed.aer_training_effect is not None or parsed.ana_training_effect is not None
    ):
        return _type_from_training_effects(
            parsed.ana_training_effect,
            parsed.aer_training_effect,
        )

    return "Base"


def _type_from_training_effects(
    ana_te: float | None,
    aer_te: float | None,
) -> str:
    ana = float(ana_te or 0)
    aer = float(aer_te or 0)
    if ana >= 4.0:
        return "Sprint"
    if ana >= 2.5:
        return "Anaerobic"
    if aer >= 4.0:
        return "VO2Max"
    if ana >= 1.0:
        return "Threshold"
    return "Base"
