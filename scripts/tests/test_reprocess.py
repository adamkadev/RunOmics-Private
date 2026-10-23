"""parse_fit is stubbed: what is under test is what reprocess.py persists, not how the bytes decode (test_fit_parser.py)."""

import json
import sys

import pytest

import reprocess
from processing.fit_parser import ActivitySplit, ParsedFit, SplitLap
from repository.json_store import JsonActivityStore

ACTIVITY_ID = "24249913094"
ACTIVITY_DATE = "2026-09-05"


def lap_splits():
    return [
        ActivitySplit("lap", 300, 1000.0, 1000.0 / 300.0, 152),
        ActivitySplit("lap", 290, 1000.0, 1000.0 / 290.0, 158),
        ActivitySplit("lap", 275, 1000.0, 1000.0 / 275.0, 164),
    ]


def interval_splits():
    return [
        ActivitySplit("interval_warmup", 600, 2000.0, 3.33, 130),
        ActivitySplit(
            "interval_active",
            240,
            1000.0,
            4.17,
            178,
            [SplitLap(96, 400.0, 4.17, 180), SplitLap(98, 400.0, 4.08, 182)],
        ),
        ActivitySplit("interval_recovery", 120, 300.0, 2.5, 140),
    ]


@pytest.fixture
def reprocess_run(tmp_path, activity_factory, monkeypatch):
    activities_dir = tmp_path / "activities"
    fit_dir = tmp_path / "fit"
    fit_dir.mkdir()
    (fit_dir / f"{ACTIVITY_ID}.fit").write_bytes(b"stubbed - parse_fit is patched")

    def run(parsed, *, stored=None, argv=("reprocess.py",)):
        overrides = stored or {}
        seed = JsonActivityStore(activities_dir)
        seed.upsert(activity_factory(ACTIVITY_ID, ACTIVITY_DATE))
        seed.all_activities()[0].update(overrides)
        seed.save()

        # The precondition each test is about: what sat on disk before the run.
        before = json.loads((activities_dir / "2026-09.json").read_text("utf-8"))["activities"][0]
        assert before["splits"] == overrides.get("splits")
        assert before["vo2maxGarmin"] == overrides.get("vo2maxGarmin")

        store = JsonActivityStore(activities_dir)
        monkeypatch.setattr(reprocess, "_FIT_DIR", fit_dir)
        monkeypatch.setattr(reprocess, "parse_fit", lambda _content: parsed)
        monkeypatch.setattr(reprocess, "JsonActivityStore", lambda: store)
        monkeypatch.setattr(sys, "argv", list(argv))

        assert reprocess.main() == 0

        written = json.loads((activities_dir / "2026-09.json").read_text("utf-8"))
        return written["activities"][0]

    return run


class TestReprocessSplits:
    def test_lap_splits_fill_in_an_activity_stored_without_any(self, reprocess_run):
        activity = reprocess_run(
            ParsedFit(duration_seconds=1_800, distance_m=5_250.0, splits=lap_splits())
        )

        assert [s["type"] for s in activity["splits"]] == ["lap", "lap", "lap"]
        assert activity["splits"][0] == {
            "type": "lap",
            "durationSec": 300,
            "distanceM": 1000.0,
            "avgSpeedMs": 3.3333,
            "avgHr": 152,
            "laps": [],
        }

    def test_no_split_or_lap_data_persists_null(self, reprocess_run):
        activity = reprocess_run(ParsedFit(duration_seconds=1_800, distance_m=5_250.0))

        assert activity["splits"] is None

    def test_interval_splits_are_written_unchanged(self, reprocess_run):
        activity = reprocess_run(
            ParsedFit(duration_seconds=3_600, distance_m=12_000.0, splits=interval_splits())
        )

        assert [s["type"] for s in activity["splits"]] == [
            "interval_warmup",
            "interval_active",
            "interval_recovery",
        ]
        active = activity["splits"][1]
        assert active["avgHr"] == 178
        assert [lap["durationSec"] for lap in active["laps"]] == [96, 98]

    def test_splits_that_disappear_from_the_fit_are_cleared(self, reprocess_run):
        activity = reprocess_run(
            ParsedFit(duration_seconds=1_800, distance_m=5_250.0),
            stored={"splits": [s.to_dict() for s in lap_splits()]},
        )

        assert activity["splits"] is None

    def test_dry_run_writes_nothing(self, reprocess_run):
        activity = reprocess_run(
            ParsedFit(duration_seconds=1_800, distance_m=5_250.0, splits=lap_splits()),
            argv=("reprocess.py", "--dry-run"),
        )

        assert activity["splits"] is None


class TestReprocessVo2max:
    """vo2maxGarmin reaches an activity only through the FIT parser, so a
    reparse is authoritative for it in both directions."""

    def test_a_missing_value_is_populated(self, reprocess_run):
        activity = reprocess_run(ParsedFit(duration_seconds=1_800, vo2max_garmin=52.0))

        assert activity["vo2maxGarmin"] == 52.0

    def test_a_stale_value_is_updated(self, reprocess_run):
        activity = reprocess_run(
            ParsedFit(duration_seconds=1_800, vo2max_garmin=54.0),
            stored={"vo2maxGarmin": 48.0},
        )

        assert activity["vo2maxGarmin"] == 54.0

    def test_a_stale_value_is_cleared_when_the_fit_no_longer_carries_one(self, reprocess_run):
        activity = reprocess_run(
            ParsedFit(duration_seconds=1_800),
            stored={"vo2maxGarmin": 48.0},
        )

        assert activity["vo2maxGarmin"] is None

    def test_dry_run_writes_nothing(self, reprocess_run):
        activity = reprocess_run(
            ParsedFit(duration_seconds=1_800, vo2max_garmin=52.0),
            stored={"vo2maxGarmin": 48.0},
            argv=("reprocess.py", "--dry-run"),
        )

        assert activity["vo2maxGarmin"] == 48.0
