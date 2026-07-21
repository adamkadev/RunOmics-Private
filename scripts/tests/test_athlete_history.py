import json
from datetime import date

import garmin.athlete as athlete
from garmin.athlete import record_athlete_history, tracked_snapshot


def test_snapshot_keeps_only_the_tracked_metrics():
    metrics = {
        "lthrBpm": 180,
        "thresholdPaceSecPerKm": 257,
        "vo2maxMlKgMin": 56.0,
        "weightKg": 62.0,
        "deviceName": "Forerunner 255 Music",
        "age": 29,
    }

    assert tracked_snapshot(metrics) == {
        "lthrBpm": 180,
        "thresholdPaceSecPerKm": 257,
        "vo2maxMlKgMin": 56.0,
        "weightKg": 62.0,
    }


def _use_tmp_history(tmp_path, monkeypatch):
    path = tmp_path / "athlete_history.json"
    monkeypatch.setattr(athlete, "_HISTORY_PATH", path)
    return path


def test_records_the_first_reading(tmp_path, monkeypatch):
    path = _use_tmp_history(tmp_path, monkeypatch)

    assert record_athlete_history({"lthrBpm": 180}, today=date(2026, 7, 21)) is True
    assert json.loads(path.read_text())["days"] == {"2026-07-21": {"lthrBpm": 180}}


def test_skips_a_sync_that_changed_nothing(tmp_path, monkeypatch):
    path = _use_tmp_history(tmp_path, monkeypatch)
    record_athlete_history({"lthrBpm": 180}, today=date(2026, 7, 21))

    assert record_athlete_history({"lthrBpm": 180}, today=date(2026, 7, 22)) is False
    assert list(json.loads(path.read_text())["days"]) == ["2026-07-21"]


def test_appends_when_a_value_moves(tmp_path, monkeypatch):
    path = _use_tmp_history(tmp_path, monkeypatch)
    record_athlete_history({"lthrBpm": 180}, today=date(2026, 7, 21))

    assert record_athlete_history({"lthrBpm": 182}, today=date(2026, 7, 28)) is True
    assert json.loads(path.read_text())["days"] == {
        "2026-07-21": {"lthrBpm": 180},
        "2026-07-28": {"lthrBpm": 182},
    }


def test_writes_nothing_when_no_tracked_metric_was_fetched(tmp_path, monkeypatch):
    path = _use_tmp_history(tmp_path, monkeypatch)

    assert record_athlete_history({"deviceName": "Forerunner 255 Music"}) is False
    assert not path.exists()
