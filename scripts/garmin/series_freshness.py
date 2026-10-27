"""The newest sample in each Garmin series file; the app decides from these dates which series has stopped updating."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Series name -> (file, the section keyed by sample date, or None for a file holding one dated sample).
SERIES: dict[str, tuple[str, str | None]] = {
    "trainingStatus": ("training_status.json", "days"),
    "loadBalance": ("training_load_balance.json", None),
    "restingHr": ("recovery_history.json", "days"),
    "racePredictions": ("race_predictions.json", "days"),
    "vo2max": ("vo2max_history.json", "days"),
    "fitnessAge": ("fitness_age_history.json", "weeks"),
    "threshold": ("threshold_history.json", "days"),
}


def series_freshness(data_dir: Path) -> dict[str, str | None]:
    return {name: _newest(data_dir / file, section) for name, (file, section) in SERIES.items()}


def _newest(path: Path, section: str | None) -> str | None:
    # sync_meta.json is written whatever state a series file is in, so an unreadable one reads as no sample.
    try:
        payload: Any = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    if section is None:
        dates = [payload.get("date")]
    else:
        samples = payload.get(section)
        dates = list(samples) if isinstance(samples, dict) else []
    valid = [day for day in dates if isinstance(day, str) and _DATE.match(day)]
    return max(valid) if valid else None
