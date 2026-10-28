from datetime import date

import pytest

from garmin import retry as retry_mod
from garmin import step_warnings, threshold_history
from garmin.client import GarminAPIError
from garmin.threshold_history import build_days, normalize_stat, sync_threshold_history
from repository.history_file import read_history, write_history

TODAY = date(2026, 10, 28)
START = date(2026, 6, 1)


class FakeConnect:
    def __init__(self, **answers):
        self.answers = answers
        self.asked: list[tuple[str, str, str]] = []

    def get_biometric_stat(self, metric, start, end):
        self.asked.append((metric, start, end))
        answer = self.answers.get(metric, [])
        if isinstance(answer, Exception):
            raise answer
        return answer


@pytest.fixture
def out(tmp_path, monkeypatch):
    path = tmp_path / "threshold_history.json"
    monkeypatch.setattr(threshold_history, "_OUT_PATH", path)
    monkeypatch.setattr(retry_mod.time, "sleep", lambda _seconds: None)
    step_warnings.reset()
    yield path
    step_warnings.reset()


def _stored(path):
    return read_history(path)["days"]


class TestNormalize:
    def test_keys_each_revision_on_the_day_it_took_effect(self):
        entries = [{"from": "2026-09-01", "value": 172.0}, {"from": "2026-10-05", "value": 175.0}]
        assert normalize_stat(entries) == {"2026-09-01": 172.0, "2026-10-05": 175.0}

    def test_skips_entries_without_a_day_or_a_value(self):
        assert normalize_stat([{"from": "2026-09-01"}, {"value": 170}, "junk", None]) == {}
        assert normalize_stat(None) == {}

    def test_build_days_converts_speed_to_pace(self):
        assert build_days({"2026-09-01": 172.4}, {"2026-09-01": 0.389}) == {
            "2026-09-01": {"date": "2026-09-01", "lthrBpm": 172, "thresholdPaceSecPerKm": 257}
        }


class TestSync:
    def test_a_failed_hr_read_keeps_the_stored_lthr_beside_the_fresh_pace(self, out):
        write_history(out, {"days": {"2026-09-01": {"date": "2026-09-01", "lthrBpm": 172, "thresholdPaceSecPerKm": 260}}})
        client = FakeConnect(
            lactateThresholdHeartRate=GarminAPIError(403, "safe-test-endpoint"),
            lactateThresholdSpeed=[{"from": "2026-09-01", "value": 0.389}],
        )

        assert sync_threshold_history(client, START, TODAY) == 1

        assert _stored(out) == {"2026-09-01": {"date": "2026-09-01", "lthrBpm": 172, "thresholdPaceSecPerKm": 257}}
        assert [w["step"] for w in step_warnings.collected()] == ["threshold history"]

    def test_both_reads_failing_leaves_the_file_as_it_was(self, out):
        stored = {"2026-09-01": {"date": "2026-09-01", "lthrBpm": 172, "thresholdPaceSecPerKm": 260}}
        write_history(out, {"days": stored})
        client = FakeConnect(
            lactateThresholdHeartRate=GarminAPIError(503, "safe-test-endpoint"),
            lactateThresholdSpeed=GarminAPIError(503, "safe-test-endpoint"),
        )

        assert sync_threshold_history(client, START, TODAY) == 1

        assert _stored(out) == stored

    def test_fresh_values_replace_stored_ones_and_new_days_are_added(self, out):
        write_history(out, {"days": {"2026-09-01": {"date": "2026-09-01", "lthrBpm": 170, "thresholdPaceSecPerKm": 265}}})
        client = FakeConnect(
            lactateThresholdHeartRate=[{"from": "2026-09-01", "value": 172.0}, {"from": "2026-10-05", "value": 175.0}],
            lactateThresholdSpeed=[{"from": "2026-09-01", "value": 0.389}],
        )

        assert sync_threshold_history(client, START, TODAY) == 2

        assert _stored(out) == {
            "2026-09-01": {"date": "2026-09-01", "lthrBpm": 172, "thresholdPaceSecPerKm": 257},
            "2026-10-05": {"date": "2026-10-05", "lthrBpm": 175},
        }

    def test_a_day_garmin_no_longer_returns_is_kept(self, out):
        write_history(out, {"days": {"2025-01-10": {"date": "2025-01-10", "lthrBpm": 168}}})
        client = FakeConnect(lactateThresholdHeartRate=[{"from": "2026-09-01", "value": 172.0}])

        assert sync_threshold_history(client, START, TODAY) == 2

        assert set(_stored(out)) == {"2025-01-10", "2026-09-01"}

    def test_nothing_stored_and_nothing_returned_writes_no_file(self, out):
        assert sync_threshold_history(FakeConnect(), START, TODAY) == 0
        assert not out.exists()
