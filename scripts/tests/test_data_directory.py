import json
import os
import subprocess
import sys
from pathlib import Path

from data_directory import get_data_dir
from repository.json_store import JsonActivityStore
from sync_upcoming_races import write_upcoming_races


def test_default_data_directory_is_server_only_root_data(monkeypatch):
    monkeypatch.delenv("RUNOMICS_DATA_DIR", raising=False)

    selected = get_data_dir()

    assert selected == Path(__file__).resolve().parents[2] / "data"
    assert "public" not in selected.parts


def test_sync_module_respects_explicit_data_directory(tmp_path):
    selected = tmp_path / "sync-data"
    scripts_dir = Path(__file__).resolve().parents[1]
    environment = {
        **os.environ,
        "PYTHONPATH": str(scripts_dir),
        "RUNOMICS_DATA_DIR": str(selected),
    }

    result = subprocess.run(
        [sys.executable, "-c", "import sync; print(sync._DATA_DIR)"],
        cwd=scripts_dir.parent,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip() == str(selected.resolve())


def test_activity_store_respects_explicit_data_directory(
    monkeypatch, tmp_path, activity_factory
):
    selected = tmp_path / "private-data"
    monkeypatch.setenv("RUNOMICS_DATA_DIR", str(selected))

    store = JsonActivityStore()
    store.upsert(activity_factory("activity-1", "2026-09-05"))
    store.save()

    assert json.loads(
        (selected / "activities" / "index.json").read_text()
    ) == {"months": ["2026-09"]}
    assert not (tmp_path / "public" / "data").exists()


def test_upcoming_races_write_to_explicit_directory_and_preserve_coaching(
    monkeypatch, tmp_path, activity_factory
):
    selected = tmp_path / "private-data"
    coaching_file = selected / "coaching" / "current_plan.json"
    coaching_file.parent.mkdir(parents=True)
    coaching_file.write_text('{"plan":"keep"}\n')
    monkeypatch.setenv("RUNOMICS_DATA_DIR", str(selected))

    store = JsonActivityStore()
    store.upsert(activity_factory("activity-1", "2026-09-05"))
    store.save()

    write_upcoming_races([
        {
            "garminEventId": 29837036,
            "date": "2026-10-03",
            "name": "Supporting 5K",
            "distance": "5K",
            "targetSeconds": 1200,
        }
    ])

    persisted = json.loads((selected / "upcoming_races.json").read_text())
    assert persisted["races"][0]["garminEventId"] == 29837036
    assert (selected / "activities" / "index.json").exists()
    assert coaching_file.read_text() == '{"plan":"keep"}\n'
    assert not (tmp_path / "public" / "data").exists()
