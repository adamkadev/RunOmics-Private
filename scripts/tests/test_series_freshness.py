import json

from garmin import step_warnings
from garmin.series_freshness import SERIES, series_freshness


def _write(directory, name, payload):
    (directory / name).write_text(payload if isinstance(payload, str) else json.dumps(payload))


def test_each_series_reads_its_newest_sample_date(tmp_path):
    _write(tmp_path, "training_status.json", {"days": {"2026-10-25": {}, "2026-10-26": {}}, "weeks": {"202643": {}}})
    _write(tmp_path, "training_load_balance.json", {"date": "2026-10-24", "aerobicLow": 120})
    _write(tmp_path, "fitness_age_history.json", {"weeks": {"2026-10-12": {}, "2026-10-19": {}}})

    freshness = series_freshness(tmp_path)

    assert freshness["trainingStatus"] == "2026-10-26"
    assert freshness["loadBalance"] == "2026-10-24"
    assert freshness["fitnessAge"] == "2026-10-19"
    assert set(freshness) == set(SERIES)


def test_a_missing_empty_or_unreadable_file_has_no_sample(tmp_path):
    _write(tmp_path, "race_predictions.json", {"days": {}})
    _write(tmp_path, "recovery_history.json", '{"days": {"2026-10-')
    _write(tmp_path, "vo2max_history.json", {"days": {"not a date": {}}})

    freshness = series_freshness(tmp_path)

    assert freshness["racePredictions"] is None
    assert freshness["restingHr"] is None
    assert freshness["vo2max"] is None
    assert freshness["trainingStatus"] is None


def test_a_warning_is_printed_and_kept_for_the_night(capsys):
    step_warnings.reset()

    step_warnings.warn("load balance", "training load balance fetch failed: HTTP 503")

    assert "Warning: training load balance fetch failed: HTTP 503" in capsys.readouterr().out
    assert step_warnings.collected() == [{"step": "load balance", "message": "training load balance fetch failed: HTTP 503"}]
    step_warnings.reset()
    assert step_warnings.collected() == []


def test_a_long_message_is_cut(capsys):
    step_warnings.reset()

    step_warnings.warn("training plan", "x" * 500)

    assert len(step_warnings.collected()[0]["message"]) == 200
    step_warnings.reset()
