#!/usr/bin/env python3

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from processing.fit_parser import parse_fit
from processing.activity_type import infer_type
from processing.mapper import _decimate_list, _MAX_CHART_POINTS

_FIT_DIR = Path(__file__).parent.parent / "public" / "fit"
_JSON_PATH = Path(__file__).parent.parent / "public" / "data" / "activities.json"


def main() -> int:
    data = json.loads(_JSON_PATH.read_text("utf-8"))
    activities = data.get("activities", [])

    updated = 0
    for a in activities:
        fit_path = _FIT_DIR / f"{a['id']}.fit"
        if not fit_path.exists():
            continue

        parsed = parse_fit(fit_path.read_bytes())
        if not parsed.has_data:
            continue

        a["type"] = infer_type(a.get("description", ""), parsed)
        a["aerTrainingEffect"] = round(parsed.aer_training_effect, 1) if parsed.aer_training_effect is not None else None
        a["anaTrainingEffect"] = round(parsed.ana_training_effect, 1) if parsed.ana_training_effect is not None else None
        a["hrSamples"] = _decimate_list(parsed.heart_rates, _MAX_CHART_POINTS) if parsed.heart_rates else None
        a["elevationProfile"] = _decimate_list(parsed.elevation_samples, _MAX_CHART_POINTS) if parsed.elevation_samples else None
        a["calories"] = parsed.calories
        a["cadenceSpm"] = parsed.cadence_spm
        a["groundContactMs"] = parsed.ground_contact_ms
        a["verticalOscillationMm"] = parsed.vertical_oscillation_mm
        a["verticalRatioPct"] = parsed.vertical_ratio_pct
        a["strideLengthM"] = parsed.stride_length_m
        a["bestEfforts"] = parsed.best_efforts or None
        a["paceSamples"] = _decimate_list(parsed.pace_samples, _MAX_CHART_POINTS) if parsed.pace_samples else None
        a["avgTemperature"] = parsed.avg_temperature
        a["cadenceSamples"] = _decimate_list(parsed.cadence_samples, _MAX_CHART_POINTS) if parsed.cadence_samples else None
        if parsed.elevation_gain_m > 0:
            a["elevationGain"] = parsed.elevation_gain_m
        updated += 1

    tmp = _JSON_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    tmp.replace(_JSON_PATH)

    print(f"{updated} activities reprocessed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
