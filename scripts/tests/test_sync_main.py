"""sync.main() end to end, against a fake Garmin client.

What is under test is the orchestration: which activities reach the store,
which steps run, and the exit code the workflow acts on - 0 clean, 3 partial
("commit what succeeded, then fail"), anything else a stop before the commit.
"""

import sys

import pytest

import sync


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    """A data workspace of its own, and none of the pauses a real run takes."""
    monkeypatch.setenv("RUNOMICS_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
    # Resolved when sync.py was imported, so re-pointed by hand.
    monkeypatch.setattr(sync, "_FIT_DIR", tmp_path / "fit-cache")
    monkeypatch.setattr(sync, "_SYNC_META_PATH", tmp_path / "sync_meta.json")
    monkeypatch.setattr(sync, "_ATHLETE_PATH", tmp_path / "athlete.json")
    # Rate-limit pauses and retry backoff are real seconds.
    monkeypatch.setattr(sync.time, "sleep", lambda _seconds: None)
    return tmp_path


def _run(monkeypatch, *args: str) -> int:
    monkeypatch.setattr(sys, "argv", ["sync.py", *args])
    return sync.main()


def _refuse_garmin(_secret):
    raise AssertionError("the sync reached Garmin")


class TestUnreadableStore:
    def test_an_unreadable_month_file_stops_the_sync_before_garmin(self, workspace, monkeypatch):
        month = workspace / "activities" / "2026-07.json"
        month.parent.mkdir()
        month.write_text('{"activities": [{"id": "1"')
        monkeypatch.setattr(sync, "GarminClient", _refuse_garmin)

        assert _run(monkeypatch) == 1
        assert month.read_text() == '{"activities": [{"id": "1"'

    def test_an_unreadable_planned_workouts_file_stops_it_too(self, workspace, monkeypatch):
        year = workspace / "planned_workouts" / "2026.json"
        year.parent.mkdir()
        year.write_text('{"planned": [{"date": "2026-07-')
        monkeypatch.setattr(sync, "GarminClient", _refuse_garmin)

        assert _run(monkeypatch) == 1
        assert year.read_text() == '{"planned": [{"date": "2026-07-'
