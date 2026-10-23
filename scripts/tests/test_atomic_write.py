import os
from datetime import date

import pytest

from garmin import training_plan, vo2max_norms
from garmin.gear import ShoeGear, write_shoes_json
from repository.atomic_write import write_text_atomic
from repository.history_file import write_history
from repository.json_store import JsonActivityStore
from sync_upcoming_races import write_upcoming_races


def _disk_full(_fd: int) -> None:
    raise OSError(28, "No space left on device")


class TestWriteTextAtomic:
    def test_writes_the_text_exactly_and_creates_the_directory(self, tmp_path):
        path = tmp_path / "nested" / "file.json"

        write_text_atomic(path, '{"name": "Récupération"}')

        assert path.read_bytes() == '{"name": "Récupération"}'.encode()

    def test_replaces_the_file_and_leaves_nothing_beside_it(self, tmp_path):
        path = tmp_path / "file.json"
        path.write_text("old")

        write_text_atomic(path, "new")

        assert path.read_text() == "new"
        assert [p.name for p in tmp_path.iterdir()] == ["file.json"]

    def test_writes_lf_whatever_the_platform(self, tmp_path):
        # A Windows run would otherwise rewrite every line of the dataset.
        path = tmp_path / "file.json"

        write_text_atomic(path, "{\n}\n")

        assert path.read_bytes() == b"{\n}\n"


class _PlanClient:
    def get_training_plans(self):
        return {
            "trainingPlanList": [
                {
                    "trainingPlanId": 1,
                    "trainingPlanCategory": "FBT_ADAPTIVE",
                    "name": "Plan",
                    "startDate": "2026-07-01T00:00:00.0",
                    "endDate": "2026-09-05T00:00:00.0",
                }
            ]
        }

    def get_training_plan_detail(self, _plan_id):
        return {"planPhases": [{"startDate": "2026-07-01", "endDate": "2026-09-05", "trainingPhase": "BUILD"}]}


# Each case: (target file, what it held before, the write), one per writer of a data file.
def _history_file(tmp_path, _monkeypatch, _factory):
    target = tmp_path / "history.json"
    return target, '{"old": true}\n', lambda: write_history(target, {"new": True})


def _activity_month(tmp_path, _monkeypatch, factory):
    def write():
        store = JsonActivityStore(tmp_path)
        store.upsert(factory("1", "2026-07-18"))
        store.save()

    return tmp_path / "2026-07.json", '{"activities": []}', write


def _upcoming_races(tmp_path, _monkeypatch, _factory):
    races = [{"date": "2026-10-03", "name": "Escher 10K", "distance": "10K"}]
    return tmp_path / "upcoming_races.json", '{"races": []}\n', lambda: write_upcoming_races(races, data_dir=tmp_path)


def _shoes(tmp_path, _monkeypatch, _factory):
    target = tmp_path / "shoes.json"
    shoe = ShoeGear("abc", "Nike", "Pegasus", 1000, False, None)
    return target, '{"shoes": []}\n', lambda: write_shoes_json([shoe], path=target)


def _vo2max_norms(tmp_path, monkeypatch, _factory):
    target = tmp_path / "vo2max_norms.json"
    monkeypatch.setattr(vo2max_norms, "_OUT_PATH", target)
    return target, "{}\n", lambda: vo2max_norms.write_vo2max_norms({"male": {}})


def _training_plan(tmp_path, monkeypatch, _factory):
    target = tmp_path / "training_plan.json"
    monkeypatch.setattr(training_plan, "_PATH", target)
    return target, '{"planId": 0}\n', lambda: training_plan.sync_training_plan(_PlanClient(), date(2026, 7, 21))


@pytest.mark.parametrize(
    "case",
    [_history_file, _activity_month, _upcoming_races, _shoes, _vo2max_norms, _training_plan],
    ids=lambda case: case.__name__.strip("_"),
)
def test_a_write_that_dies_leaves_the_previous_file_whole(case, tmp_path, monkeypatch, activity_factory):
    # The disk fills after the new content went out and before the rename.
    target, previous, write = case(tmp_path, monkeypatch, activity_factory)
    target.write_text(previous, encoding="utf-8")
    monkeypatch.setattr(os, "fsync", _disk_full)

    with pytest.raises(OSError):
        write()

    assert target.read_text(encoding="utf-8") == previous
    assert [p.name for p in tmp_path.iterdir()] == [target.name]
