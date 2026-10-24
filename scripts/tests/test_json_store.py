import json

import pytest

from repository.history_file import HistoryFileError
from repository.json_store import JsonActivityStore, PlannedWorkoutStore, dumps_readable


class TestPlannedWorkoutStore:
    def test_upsert_and_save_creates_year_file_and_index(self, tmp_path):
        store = PlannedWorkoutStore(tmp_path)
        store.upsert({"date": "2026-07-18", "name": "Seuil"})
        store.upsert({"date": "2025-12-01", "name": "Footing"})
        store.save()

        assert json.loads((tmp_path / "2026.json").read_text())["planned"] == [
            {"date": "2026-07-18", "name": "Seuil"}
        ]
        assert json.loads((tmp_path / "2025.json").read_text())["planned"] == [
            {"date": "2025-12-01", "name": "Footing"}
        ]
        assert json.loads((tmp_path / "index.json").read_text())["years"] == ["2026", "2025"]

    def test_reload_from_disk_round_trips(self, tmp_path):
        store = PlannedWorkoutStore(tmp_path)
        store.upsert({"date": "2026-07-18", "name": "Seuil"})
        store.save()

        reloaded = PlannedWorkoutStore(tmp_path)

        assert reloaded.get("2026-07-18") == {"date": "2026-07-18", "name": "Seuil"}
        assert reloaded.count() == 1

    def test_get_returns_none_for_unknown_date(self, tmp_path):
        store = PlannedWorkoutStore(tmp_path)
        assert store.get("2026-01-01") is None

    def test_accented_characters_round_trip(self, tmp_path):
        store = PlannedWorkoutStore(tmp_path)
        store.upsert({"date": "2026-07-18", "name": "3 x 2000m allure spécifique"})
        store.save()

        reloaded = PlannedWorkoutStore(tmp_path)
        assert reloaded.get("2026-07-18")["name"] == "3 x 2000m allure spécifique"

    def test_save_only_rewrites_dirty_years(self, tmp_path):
        store = PlannedWorkoutStore(tmp_path)
        store.upsert({"date": "2026-07-18", "name": "Seuil"})
        store.upsert({"date": "2025-12-01", "name": "Footing"})
        store.save()

        year_2025_path = tmp_path / "2025.json"
        before = year_2025_path.stat().st_mtime_ns

        store.upsert({"date": "2026-07-19", "name": "Footing 2"})
        store.save()

        assert year_2025_path.stat().st_mtime_ns == before

    def test_save_is_a_noop_when_nothing_changed(self, tmp_path):
        store = PlannedWorkoutStore(tmp_path)
        store.save()

        assert list(tmp_path.iterdir()) == []


class TestJsonActivityStoreSmoke:
    def test_upsert_and_save_creates_year_file_and_index(self, tmp_path):
        from processing.mapper import ActivityData

        store = JsonActivityStore(tmp_path)
        activity = ActivityData(
            id="123",
            week=202629,
            date="2026-07-18",
            day_of_week="Saturday",
            type="Threshold",
            description="Seuil",
            duration_seconds=1800,
            distance_km=5.0,
            pace_sec_per_km=360.0,
            hr_zones=[],
            avg_heart_rate=150,
            rpe=None,
            comment="",
            polyline=None,
            route=None,
            elevation_gain=None,
            aer_training_effect=None,
            ana_training_effect=None,
            hr_samples=None,
            elevation_profile=None,
            calories=None,
            cadence_spm=None,
            ground_contact_ms=None,
            vertical_oscillation_mm=None,
            vertical_ratio_pct=None,
            stride_length_m=None,
            best_efforts=None,
            splits=None,
            pace_samples=None,
            vo2max_garmin=None,
            avg_temperature=None,
            cadence_samples=None,
            gear_id=None,
        )
        store.upsert(activity)
        store.save()

        written = json.loads((tmp_path / "2026-07.json").read_text())
        assert written["activities"][0]["id"] == "123"
        assert json.loads((tmp_path / "index.json").read_text())["months"] == ["2026-07"]

    def test_resync_keeps_weather_already_on_file(self, tmp_path, activity_factory):
        store = JsonActivityStore(tmp_path)
        stored = activity_factory("1", "2026-07-18")
        stored.weather = {"tempC": 19.0, "code": 0}
        store.upsert(stored)

        store.upsert(activity_factory("1", "2026-07-18"))

        assert store.all_activities()[0]["weather"] == {"tempC": 19.0, "code": 0}

    def test_replace_drops_weather_along_with_everything_else(self, tmp_path, activity_factory):
        store = JsonActivityStore(tmp_path)
        stored = activity_factory("1", "2026-07-18")
        stored.weather = {"tempC": 19.0, "code": 0}
        store.upsert(stored)

        store.upsert(activity_factory("1", "2026-07-18"), replace=True)

        assert store.all_activities()[0]["weather"] is None

    def test_replace_keeps_the_hand_entered_comment_and_rpe(self, tmp_path, activity_factory):
        # sync.py --force re-fetches everything, and what was typed into the data repository has no Garmin source.
        store = JsonActivityStore(tmp_path)
        stored = activity_factory("1", "2026-07-18")
        stored.comment = "Legs heavy after Sunday"
        stored.rpe = 7
        store.upsert(stored)

        store.upsert(activity_factory("1", "2026-07-18"), replace=True)

        replaced = store.all_activities()[0]
        assert replaced["comment"] == "Legs heavy after Sunday"
        assert replaced["rpe"] == 7

    def test_replace_takes_the_fresh_rpe_where_none_was_stored(self, tmp_path, activity_factory):
        store = JsonActivityStore(tmp_path)
        store.upsert(activity_factory("1", "2026-07-18"))
        fresh = activity_factory("1", "2026-07-18")
        fresh.rpe = 5

        store.upsert(fresh, replace=True)

        assert store.all_activities()[0]["rpe"] == 5

    def test_keep_gear_leaves_the_shoe_on_file_when_nothing_asked_for_it(self, tmp_path, activity_factory):
        store = JsonActivityStore(tmp_path)
        stored = activity_factory("1", "2026-07-18")
        stored.gear_id = "shoe1"
        store.upsert(stored)

        store.upsert(activity_factory("1", "2026-07-18"), replace=True, keep_gear=True)

        assert store.all_activities()[0]["gearId"] == "shoe1"

    def test_keep_zone_bounds_keeps_the_recorded_bpm_for_the_same_time_in_zones(self, tmp_path, activity_factory):
        # The Personal API sends the athlete's current zones: Lamiaa's runs of
        # Sep 2025 came back with 124 and 165 bpm floors where Connect had
        # stored the 123 and 164 they were recorded with.
        from processing.mapper import HrZone

        def zones(floors, seconds=(30, 360)):
            pairs = enumerate(zip(floors, seconds, strict=True), 1)
            return [HrZone(zone=n, seconds=s, percent=0.0, min_bpm=f, max_bpm=None) for n, (f, s) in pairs]

        store = JsonActivityStore(tmp_path)
        stored = activity_factory("1", "2026-07-18")
        stored.hr_zones = zones((103, 123))
        store.upsert(stored)

        fetched = activity_factory("1", "2026-07-18")
        fetched.hr_zones = zones((103, 124))
        store.upsert(fetched, replace=True, keep_zone_bounds=True)
        assert [z["minBpm"] for z in store.all_activities()[0]["hrZones"]] == [103, 123]

        # Different times are a different reading: they are taken whole.
        fetched.hr_zones = zones((103, 124), seconds=(31, 360))
        store.upsert(fetched, replace=True, keep_zone_bounds=True)
        assert [z["minBpm"] for z in store.all_activities()[0]["hrZones"]] == [103, 124]

    def test_save_only_rewrites_dirty_months(self, tmp_path, activity_factory):
        store = JsonActivityStore(tmp_path)
        store.upsert(activity_factory("1", "2026-06-10"))
        store.upsert(activity_factory("2", "2026-07-18"))
        store.save()

        june = tmp_path / "2026-06.json"
        before = june.stat().st_mtime_ns

        store.upsert(activity_factory("3", "2026-07-19"))
        store.save()

        assert june.stat().st_mtime_ns == before
        assert json.loads((tmp_path / "2026-07.json").read_text())["activities"][0]["id"] == "3"

    def test_months_of_the_same_year_land_in_separate_files(self, tmp_path, activity_factory):
        store = JsonActivityStore(tmp_path)
        store.upsert(activity_factory("1", "2026-01-05"))
        store.upsert(activity_factory("2", "2026-12-31"))
        store.save()

        assert json.loads((tmp_path / "2026-01.json").read_text())["activities"][0]["id"] == "1"
        assert json.loads((tmp_path / "2026-12.json").read_text())["activities"][0]["id"] == "2"
        assert json.loads((tmp_path / "index.json").read_text())["months"] == ["2026-12", "2026-01"]

    def test_reload_from_disk_round_trips(self, tmp_path, activity_factory):
        store = JsonActivityStore(tmp_path)
        store.upsert(activity_factory("1", "2026-01-05"))
        store.upsert(activity_factory("2", "2026-07-18"))
        store.save()

        reloaded = JsonActivityStore(tmp_path)

        assert reloaded.count() == 2
        assert reloaded.get_existing_ids() == {"1", "2"}

    def test_save_is_a_noop_when_nothing_changed(self, tmp_path):
        store = JsonActivityStore(tmp_path)
        store.save()

        assert not (tmp_path / "index.json").exists()


class TestUnreadableFilesStopTheStore:
    """save() rewrites every dirty file from memory, so a store must refuse to load rather than start from a partial view."""

    def test_a_truncated_year_file_is_refused_not_overwritten(self, tmp_path):
        seeded = PlannedWorkoutStore(tmp_path)
        for day in range(1, 8):
            seeded.upsert({"date": f"2026-07-0{day}", "name": "Footing"})
        seeded.save()
        year_file = tmp_path / "2026.json"
        year_file.write_text(year_file.read_text()[:-40])
        truncated = year_file.read_bytes()

        with pytest.raises(HistoryFileError) as exc:
            PlannedWorkoutStore(tmp_path)

        assert "2026.json" in str(exc.value)
        assert year_file.read_bytes() == truncated

    def test_a_month_file_that_does_not_parse_is_refused(self, tmp_path):
        (tmp_path / "2026-07.json").write_text('{"activities": [{"id": "1", "da')

        with pytest.raises(HistoryFileError) as exc:
            JsonActivityStore(tmp_path)

        assert "2026-07.json" in str(exc.value)

    @pytest.mark.parametrize(
        "payload",
        [
            [1, 2, 3],
            {"activities": "not a list"},
            {"activities": [{"date": "2026-07-18"}]},
        ],
        ids=["not an object", "activities not a list", "entry without an id"],
    )
    def test_a_month_file_of_the_wrong_shape_is_refused(self, tmp_path, payload):
        (tmp_path / "2026-07.json").write_text(json.dumps(payload))

        with pytest.raises(HistoryFileError) as exc:
            JsonActivityStore(tmp_path)

        assert "2026-07.json" in str(exc.value)

    def test_a_year_entry_without_a_date_is_refused(self, tmp_path):
        (tmp_path / "2026.json").write_text(json.dumps({"planned": [{"name": "Seuil"}]}))

        with pytest.raises(HistoryFileError):
            PlannedWorkoutStore(tmp_path)

    def test_an_absent_directory_is_an_empty_start(self, tmp_path):
        assert JsonActivityStore(tmp_path / "activities").count() == 0
        assert PlannedWorkoutStore(tmp_path / "planned_workouts").count() == 0


def test_files_read_back_the_same_with_each_route_on_one_line():
    run = {"id": "1", "route": [[6.1734, 49.1198], [6.1736, 49.1201]], "hr": [140, 142], "splits": [{"km": 1}], "note": "é"}
    data = {"activities": [run]}
    text = dumps_readable(data)

    assert json.loads(text) == data
    assert '"route": [[6.1734,49.1198],[6.1736,49.1201]]' in text
    assert '"note": "é"' in text
