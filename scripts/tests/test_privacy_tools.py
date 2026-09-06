"""The two standalone privacy utilities that read already-stored activities.

Neither has a ParsedFit to consult, so both decide race status from the stored
record (processing/privacy.py > is_confirmed_race). They are covered here
because the race exemption changed what each one does: the migration must not
re-crop a race, and the verifier must not report one as a failure.

Both run against a store in tmp_path - JsonActivityStore()/get_data_dir() would
otherwise resolve to the real workspace, and the migration writes.
"""

import json
import sys

import pytest

import migrate_privacy_zone
import verify_privacy_zone
from repository.json_store import JsonActivityStore

MONTH = "2026-09"

FULL_ROUTE = [[0.0, 0.0], [1.0, 1.0], [2.0, 2.0], [0.0, 0.0]]
CROPPED_ROUTE = [[1.0, 1.0], [2.0, 2.0]]


def stored_activity(activity_id, activity_type, type_source, route):
    return {
        "id": activity_id,
        "date": f"{MONTH}-05",
        "type": activity_type,
        "typeSource": type_source,
        "description": "Race the sunset" if activity_type != "Race" else "Fictionville 10K",
        "route": route,
    }


@pytest.fixture
def activities_dir(tmp_path):
    """Writes a month file directly: these tools read raw stored JSON, so the
    fixture seeds exactly the shape they will meet on disk."""
    directory = tmp_path / "activities"
    directory.mkdir()

    def seed(activities):
        (directory / f"{MONTH}.json").write_text(
            json.dumps({"activities": activities}), encoding="utf-8"
        )
        (directory / "index.json").write_text(json.dumps({"months": [MONTH]}), encoding="utf-8")
        return directory

    return seed


def routes_on_disk(directory):
    stored = json.loads((directory / f"{MONTH}.json").read_text("utf-8"))
    return {a["id"]: a["route"] for a in stored["activities"]}


class TestMigratePrivacyZone:
    def test_crops_a_normal_activity_and_leaves_a_garmin_race_whole(
        self, activities_dir, monkeypatch, capsys
    ):
        directory = activities_dir([
            stored_activity("normal", "Base", "garmin", list(FULL_ROUTE)),
            stored_activity("race", "Race", "garmin", list(FULL_ROUTE)),
        ])
        store = JsonActivityStore(directory)
        monkeypatch.setattr(migrate_privacy_zone, "JsonActivityStore", lambda: store)

        assert migrate_privacy_zone.main() == 0

        routes = routes_on_disk(directory)
        assert routes["normal"] == CROPPED_ROUTE
        assert routes["race"] == FULL_ROUTE
        assert "1 Garmin-confirmed races left whole" in capsys.readouterr().out

    def test_a_race_named_activity_without_garmin_evidence_is_still_cropped(
        self, activities_dir, monkeypatch
    ):
        directory = activities_dir([
            stored_activity("named", "Base", "garmin", list(FULL_ROUTE)),
            stored_activity("inferred", "Race", "runomics", list(FULL_ROUTE)),
        ])
        store = JsonActivityStore(directory)
        monkeypatch.setattr(migrate_privacy_zone, "JsonActivityStore", lambda: store)

        assert migrate_privacy_zone.main() == 0

        routes = routes_on_disk(directory)
        assert routes["named"] == CROPPED_ROUTE
        assert routes["inferred"] == CROPPED_ROUTE


class TestVerifyPrivacyZone:
    @pytest.fixture(autouse=True)
    def local_argv(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["verify_privacy_zone.py"])

    def test_an_uncropped_normal_activity_still_fails(
        self, activities_dir, monkeypatch, capsys
    ):
        directory = activities_dir([stored_activity("normal", "Base", "garmin", list(FULL_ROUTE))])
        monkeypatch.setattr(verify_privacy_zone, "_LOCAL_DIR", directory)

        assert verify_privacy_zone.main() == 1
        assert "STILL EXPOSED" in capsys.readouterr().out

    def test_a_garmin_race_with_a_full_course_is_not_a_failure(
        self, activities_dir, monkeypatch, capsys
    ):
        directory = activities_dir([stored_activity("race", "Race", "garmin", list(FULL_ROUTE))])
        monkeypatch.setattr(verify_privacy_zone, "_LOCAL_DIR", directory)

        assert verify_privacy_zone.main() == 0
        out = capsys.readouterr().out
        assert "STILL EXPOSED" not in out
        # The exemption is reported, not silent.
        assert "1 Garmin-confirmed race route(s) exempt" in out

    def test_a_locally_inferred_race_is_not_exempt(self, activities_dir, monkeypatch, capsys):
        directory = activities_dir([stored_activity("inferred", "Race", "runomics", list(FULL_ROUTE))])
        monkeypatch.setattr(verify_privacy_zone, "_LOCAL_DIR", directory)

        assert verify_privacy_zone.main() == 1
        assert "STILL EXPOSED" in capsys.readouterr().out

    def test_clean_data_passes(self, activities_dir, monkeypatch, capsys):
        directory = activities_dir([stored_activity("normal", "Base", "garmin", list(CROPPED_ROUTE))])
        monkeypatch.setattr(verify_privacy_zone, "_LOCAL_DIR", directory)

        assert verify_privacy_zone.main() == 0
        assert "OK - 0 of 1 activities" in capsys.readouterr().out
