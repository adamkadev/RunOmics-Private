import json
import sys

import pytest

import sync_shoes


class _FakeGarmin:
    """Garmin's gear list: one active pair of shoes, and a bike that is not one."""

    def __init__(self, _secret: str) -> None:
        pass

    def __enter__(self) -> "_FakeGarmin":
        return self

    def __exit__(self, *_exc) -> None:
        return None

    def get_gear_list(self, status: str, start: int = 0, limit: int = 100) -> list[dict]:
        if status != "ACTIVE":
            return []
        return [
            {
                "uuid": "7b9054fa-affb-4305-a63a-c38d2e72909b",
                "gearType": "SHOES",
                "brand": "Nike",
                "model": "Vomero Plus",
                "maxUsageDistanceMeters": 800000.0,
                "firstUseDate": "2026-05-01",
            },
            {"uuid": "b1ke", "gearType": "BIKE", "brand": "Canyon", "model": "Grail"},
        ]


@pytest.fixture
def run(tmp_path, monkeypatch):
    monkeypatch.setenv("RUNOMICS_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
    monkeypatch.setattr(sync_shoes, "GarminClient", _FakeGarmin)

    def main(*args: str) -> int:
        monkeypatch.setattr(sys, "argv", ["sync_shoes.py", *args])
        return sync_shoes.main()

    return main


def test_lists_the_shoes_and_writes_shoes_json_to_the_workspace(run, tmp_path, capsys):
    assert run() == 0

    assert "Nike Vomero Plus  (active, max 800 km)  7b9054faaffb4305a63ac38d2e72909b" in capsys.readouterr().out
    assert json.loads((tmp_path / "shoes.json").read_text()) == {
        "shoes": [
            {
                "gearId": "7b9054faaffb4305a63ac38d2e72909b",
                "brand": "Nike",
                "model": "Vomero Plus",
                "maxKm": 800,
                "retired": False,
                "firstUseDate": "2026-05-01",
            }
        ]
    }


def test_a_dry_run_previews_without_writing(run, tmp_path, capsys):
    assert run("--dry-run") == 0

    assert '"model": "Vomero Plus"' in capsys.readouterr().out
    assert not (tmp_path / "shoes.json").exists()
