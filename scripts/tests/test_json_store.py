import json

from repository.json_store import JsonActivityStore, PlannedWorkoutStore


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
    """Light coverage for the shared _atomic_write_json path, added while
    extracting it - JsonActivityStore had no direct tests before this."""

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
