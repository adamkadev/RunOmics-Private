"""The Python half of the data contract with the app.

A realistic activity goes through the real mapper and the real store, and
the files the store writes must equal fixtures/contract/ byte for byte. The
TypeScript half (src/infrastructure/contracts/__tests__/pythonFixture.test.ts)
checks those same files against the app's contract. Between them, a change to
what the sync writes cannot reach the app unnoticed: it fails here first, and
once the fixture is regenerated it fails there if the app cannot read it.

When the change here is intended, regenerate the fixture and commit it:

    UPDATE_CONTRACT_FIXTURE=1 python -m pytest scripts/tests/test_contract_fixture.py
"""

import os
from datetime import datetime
from pathlib import Path

from processing.fit_parser import ActivitySplit, ParsedFit, SplitLap
from processing.mapper import HrZone, map_activity
from repository.json_store import JsonActivityStore

_FIXTURE_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "contract" / "activities"

# Fictional throughout: an activity id no Garmin account has, and a route
# nowhere near anyone's.
_GARMIN_SUMMARY = {
    "activityId": 424242,
    "activityName": "Morning Run",
    "startTimeLocal": "2026-09-10 07:12:03",
    "activityType": {"typeKey": "running"},
    "summaryDTO": {"duration": 2712.4, "distance": 7400.0, "averageHR": 148, "elevationGain": 41.0},
}


def _parsed() -> ParsedFit:
    route = [[20.5 + i * 0.0005, 5.1 + i * 0.0003] for i in range(12)]
    return ParsedFit(
        route=route,
        heart_rates=[132, 141, 147, 150, 152, 151],
        elevation_samples=[212.0, 214.5, 219.0, 216.0],
        elevation_gain_m=41.0,
        start_time_local=datetime(2026, 9, 10, 7, 12, 3),
        duration_seconds=2712,
        distance_m=7400.0,
        avg_heart_rate=148,
        max_heart_rate=163,
        aer_training_effect=3.1,
        ana_training_effect=0.4,
        primary_benefit=1,
        calories=512,
        cadence_spm=172.0,
        best_efforts={"1k": 318.0, "5k": 1712.0},
        duration_bests={"30": 96.1, "60": 189.4, "120": 371.0},
        pace_samples=[372.0, 366.0, 361.0],
        gap_factor=1.0123,
        gap_samples=[365.4, 361.2, 358.9],
        cadence_samples=[170.0, 172.0, 174.0],
        splits=[ActivitySplit("lap", 1832, 5000.0, 2.73, 147, [SplitLap(366, 1000.0, 2.73, 145)])],
    )


def _write_through_the_store(root: Path) -> Path:
    activities_dir = root / "activities"
    store = JsonActivityStore(activities_dir)
    zones = [HrZone(zone=2, seconds=1900, percent=70.0, min_bpm=130, max_bpm=150)]
    store.upsert(map_activity(_GARMIN_SUMMARY, _parsed(), hr_zones=zones))
    store.save()
    return activities_dir


def test_the_store_writes_the_contract_fixture(tmp_path):
    written = _write_through_the_store(tmp_path)
    files = sorted(p.name for p in written.glob("*.json"))

    if os.environ.get("UPDATE_CONTRACT_FIXTURE") == "1":
        _FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
        for name in files:
            (_FIXTURE_DIR / name).write_bytes((written / name).read_bytes())

    assert files == sorted(p.name for p in _FIXTURE_DIR.glob("*.json")), "fixture files differ - see the module docstring"
    for name in files:
        assert (written / name).read_bytes() == (_FIXTURE_DIR / name).read_bytes(), (
            f"{name} no longer matches fixtures/contract/activities/{name} - "
            "regenerate it if the change is intended (see the module docstring)"
        )
