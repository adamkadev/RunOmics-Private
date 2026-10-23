"""The workflow acts on the exit code: 0 clean, 3 partial ("commit what succeeded, then fail"), else a stop before the commit."""

import json
import sys
from datetime import date
from types import SimpleNamespace

import httpx
import pytest

import sync
from garmin.client import GarminAPIError, GarminClient
from repository.json_store import JsonActivityStore

# Every step main() runs besides the activities, under the names it imports them as; here they only record that they ran.
_STEP_RESULTS = {
    "fetch_planned_workouts": ([], set()),
    "write_planned_workouts": None,
    "fetch_upcoming_races": [],
    "write_upcoming_races": None,
    "fetch_athlete_metrics": {},
    "record_athlete_history": False,
    "sync_fitness_age_history": 0,
    "fetch_vo2max_norms": None,
    "write_vo2max_norms": False,
    "sync_training_status": 0,
    "sync_vo2max_history": 0,
    "sync_threshold_history": 0,
    "sync_race_predictions": 0,
    "sync_recovery_history": 0,
    "sync_load_balance": False,
    "sync_training_plan": False,
}


class FakeGarmin:
    """Two activities known by their API summary alone; a test breaks one call through `failures`."""

    def __init__(self) -> None:
        self.details = {
            "101": _summary(101, "2026-09-20 07:00:00"),
            "102": _summary(102, "2026-09-21 18:30:00"),
        }
        self.gear: dict[str, list[dict]] = {}
        self.failures: dict[tuple[str, str], Exception] = {}

    # sync.main() builds its client as GarminClient(secret) and enters it.
    def __call__(self, _secret: str) -> "FakeGarmin":
        return self

    def __enter__(self) -> "FakeGarmin":
        return self

    def __exit__(self, *_exc) -> None:
        return None

    def _answer(self, method: str, activity_id: str, value):
        failure = self.failures.get((method, activity_id))
        if failure is not None:
            raise failure
        return value

    def get_all_activity_ids(self, *, running_only: bool = True) -> list[str]:
        return list(self.details)

    def get_activity_detail(self, activity_id: str) -> dict:
        return self._answer("get_activity_detail", activity_id, self.details[activity_id])

    def download_fit(self, activity_id: str, *, strict_errors: bool = False):
        return self._answer("download_fit", activity_id, None)

    def get_hr_zones(self, activity_id: str, *, strict_errors: bool = False) -> list[dict]:
        return self._answer("get_hr_zones", activity_id, [])

    def get_activity_gear(self, activity_id: str, *, strict_errors: bool = False) -> list[dict]:
        return self._answer("get_activity_gear", activity_id, self.gear.get(activity_id, []))


def _summary(activity_id: int, start: str) -> dict:
    return {
        "activityId": activity_id,
        "activityName": "Morning Run",
        "startTimeLocal": start,
        "activityType": {"typeKey": "running"},
        "distance": 10000.0,
        "duration": 3000.0,
    }


@pytest.fixture
def garmin(monkeypatch) -> FakeGarmin:
    fake = FakeGarmin()
    monkeypatch.setattr(sync, "GarminClient", fake)
    return fake


@pytest.fixture
def steps(monkeypatch) -> list[str]:
    ran: list[str] = []

    def recorder(name, result):
        def step(*_args, **_kwargs):
            ran.append(name)
            return result

        return step

    for name, result in _STEP_RESULTS.items():
        monkeypatch.setattr(sync, name, recorder(name, result))
    return ran


def _stored_ids(workspace) -> set[str]:
    return JsonActivityStore(workspace / "activities").get_existing_ids()


def _stored_gear(workspace, activity_id: str) -> str | None:
    stored = JsonActivityStore(workspace / "activities").all_activities()
    return next(a for a in stored if a["id"] == activity_id).get("gearId")


def _store_todays_run(workspace, activity_factory, *, gear_id: str) -> None:
    run = activity_factory("090", date.today().isoformat())
    run.gear_id = gear_id
    store = JsonActivityStore(workspace / "activities")
    store.upsert(run)
    store.save()


@pytest.fixture
def workspace(tmp_path, monkeypatch):
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


class TestCleanRun:
    def test_every_activity_is_saved_every_step_runs_and_it_exits_0(
        self, workspace, garmin, steps, monkeypatch
    ):
        assert _run(monkeypatch) == 0

        assert _stored_ids(workspace) == {"101", "102"}
        assert steps == list(_STEP_RESULTS)
        assert "lastSyncedAt" in json.loads((workspace / "sync_meta.json").read_text())

    def test_one_failing_activity_is_left_out_the_rest_saved_and_it_exits_3(
        self, workspace, garmin, steps, monkeypatch
    ):
        garmin.failures[("get_activity_detail", "101")] = GarminAPIError(500, "https://example.test/activity")

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert _stored_ids(workspace) == {"102"}
        assert steps == list(_STEP_RESULTS)
        assert (workspace / "sync_meta.json").exists()

    def test_a_dry_run_writes_nothing_and_runs_no_step(self, workspace, garmin, steps, monkeypatch):
        assert _run(monkeypatch, "--dry-run") == 0

        assert not (workspace / "activities").exists()
        assert not (workspace / "sync_meta.json").exists()
        assert steps == []


class TestFailingStep:
    """Each step after store.save() writes a file of its own, so one raising must not cost the commit."""

    def test_the_other_steps_still_run_and_it_exits_3(self, workspace, garmin, steps, monkeypatch, capsys):
        def unavailable(_client):
            raise RuntimeError("HTTP 503 from race-predictions")

        monkeypatch.setattr(sync, "sync_race_predictions", unavailable)

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert _stored_ids(workspace) == {"101", "102"}
        assert steps[-2:] == ["sync_load_balance", "sync_training_plan"]
        assert "lastSyncedAt" in json.loads((workspace / "sync_meta.json").read_text())
        assert "race predictions failed (RuntimeError: HTTP 503 from race-predictions)" in capsys.readouterr().out

    def test_a_corrupt_history_file_stops_only_the_step_that_reads_it(
        self, workspace, garmin, steps, monkeypatch
    ):
        # athlete.json is the only copy of what was merged into it, so its step must refuse to rewrite it.
        athlete = workspace / "athlete.json"
        athlete.write_text('{"lthrBpm": 17')
        monkeypatch.setattr(sync, "fetch_athlete_metrics", lambda _client: {"lthrBpm": 172})

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert athlete.read_text() == '{"lthrBpm": 17'
        assert "sync_training_plan" in steps
        assert _stored_ids(workspace) == {"101", "102"}

    def test_a_failing_planned_workout_sync_counts_as_partial_too(self, workspace, garmin, steps, monkeypatch):
        def calendar_down(_client):
            raise RuntimeError("HTTP 500 from calendar-service")

        monkeypatch.setattr(sync, "fetch_planned_workouts", calendar_down)

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert _stored_ids(workspace) == {"101", "102"}
        assert steps[-1] == "sync_training_plan"


class TestOptionalActivityResources:
    """Only a 404 means an activity has no FIT file, HR zones or gear; anything else fails it, so the next run retries."""

    @pytest.mark.parametrize("method", ["download_fit", "get_hr_zones", "get_activity_gear"])
    def test_a_5xx_fails_the_activity_rather_than_storing_it_without(
        self, workspace, garmin, steps, monkeypatch, method
    ):
        garmin.failures[(method, "102")] = GarminAPIError(503, f"https://example.test/{method}")

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert _stored_ids(workspace) == {"101"}

    def test_a_fit_file_that_decodes_to_nothing_fails_the_activity(self, workspace, garmin, steps, monkeypatch):
        monkeypatch.setattr(
            garmin, "download_fit", lambda activity_id, **_: b"not a FIT file" if activity_id == "102" else None
        )

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert _stored_ids(workspace) == {"101"}
        assert not (workspace / "fit-cache" / "102.fit").exists()


class TestGearRefresh:
    """Only a successful answer may change the stored gear: "no gear" writes None over it."""

    @pytest.mark.parametrize(
        "error", [GarminAPIError(503, "u"), GarminAPIError(404, "u")], ids=["5xx", "404"]
    )
    def test_an_error_never_overwrites_the_stored_gear(
        self, workspace, steps, monkeypatch, activity_factory, error
    ):
        _store_todays_run(workspace, activity_factory, gear_id="shoe1")
        _garmin_whose_gear_request_fails(monkeypatch, error)

        assert _run(monkeypatch) == 0

        assert _stored_gear(workspace, "090") == "shoe1"

    def test_a_successful_answer_still_updates_it(self, workspace, steps, monkeypatch, activity_factory):
        _store_todays_run(workspace, activity_factory, gear_id="shoe1")
        client = _garmin_whose_gear_request_fails(monkeypatch, None)
        client._get = lambda _url, **_kwargs: SimpleNamespace(json=lambda: [{"uuid": "shoe2"}])

        assert _run(monkeypatch) == 0

        assert _stored_gear(workspace, "090") == "shoe2"

    def test_a_network_error_does_not_lose_the_nights_activities(
        self, workspace, garmin, steps, monkeypatch, activity_factory
    ):
        _store_todays_run(workspace, activity_factory, gear_id="shoe1")
        garmin.failures[("get_activity_gear", "090")] = httpx.ConnectError("connection reset")

        assert _run(monkeypatch) == 0

        assert _stored_ids(workspace) == {"090", "101", "102"}
        assert _stored_gear(workspace, "090") == "shoe1"


def _garmin_whose_gear_request_fails(monkeypatch, error) -> GarminClient:
    """The real client over a fake transport: what is under test is its own reading of an error answer."""
    client = object.__new__(GarminClient)
    client._base = "https://example.test"
    client._http = SimpleNamespace(close=lambda: None)

    def get(url, **_kwargs):
        raise error

    client._get = get
    client.get_all_activity_ids = lambda *, running_only=True: []
    monkeypatch.setattr(sync, "GarminClient", lambda _secret: client)
    return client
