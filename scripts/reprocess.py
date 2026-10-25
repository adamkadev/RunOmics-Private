#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from data_directory import get_fit_cache_dir
from processing.fit_parser import parse_fit
from processing.activity_type import infer_type_with_source
from processing.mapper import _decimate_list, _MAX_CHART_POINTS, grade_adjusted
from repository.json_store import JsonActivityStore

_FIT_DIR = get_fit_cache_dir()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Re-run the FIT parser on all cached FIT files and rewrite activities JSON"
    )
    parser.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    args = parser.parse_args()

    store = JsonActivityStore()

    updated = uncached = 0
    for a in store.all_activities():
        fit_path = _FIT_DIR / f"{a['id']}.fit"
        if not fit_path.exists():
            uncached += 1
            continue

        parsed = parse_fit(fit_path.read_bytes())
        if not parsed.has_data:
            continue

        type_inference = infer_type_with_source(
            a.get("description", ""),
            parsed,
            hr_zones=a.get("hrZones") or [],
            duration_seconds=a.get("durationSeconds"),
        )
        a["type"] = type_inference.activity_type
        a["typeSource"] = type_inference.source
        if parsed.route:
            a["route"] = parsed.route
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
        a["durationBests"] = parsed.duration_bests or None
        a["paceSamples"] = _decimate_list(parsed.pace_samples, _MAX_CHART_POINTS) if parsed.pace_samples else None
        a["gapSecPerKm"], a["gapSamples"] = grade_adjusted(parsed, a.get("paceSecPerKm"))
        a["vo2maxGarmin"] = parsed.vo2max_garmin
        a["avgTemperature"] = parsed.avg_temperature
        a["cadenceSamples"] = _decimate_list(parsed.cadence_samples, _MAX_CHART_POINTS) if parsed.cadence_samples else None
        a["splits"] = [s.to_dict() for s in parsed.splits] if parsed.splits else None
        if parsed.elevation_gain_m > 0:
            a["elevationGain"] = parsed.elevation_gain_m
        store.touch(a["id"])
        updated += 1

    if uncached:
        print(f"{uncached} activities have no cached FIT file and keep what they had: a forced sync downloads them.")
    if args.dry_run:
        print(f"Dry run: {updated} activities would be reprocessed (nothing written).")
        return 0

    store.save()

    print(f"{updated} activities reprocessed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
