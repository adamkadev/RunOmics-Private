from __future__ import annotations

import re
from typing import TYPE_CHECKING

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


def infer_type(name: str, parsed: "ParsedFit | None") -> str:
    if parsed and parsed.is_race:
        return "Race"

    if parsed and parsed.primary_benefit in _PRIMARY_BENEFIT_TYPES:
        return _PRIMARY_BENEFIT_TYPES[parsed.primary_benefit]

    return "Base"