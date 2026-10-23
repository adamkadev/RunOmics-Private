"""sync.main() end to end, against a fake Garmin client.

What is under test is the orchestration: which activities reach the store,
which steps run, and the exit code the workflow acts on - 0 clean, 3 partial
("commit what succeeded, then fail"), anything else a stop before the commit.
"""

import json
import sys
from datetime import date
from types import SimpleNamespace

import httpx
import pytest

import sync
from garmin.client import GarminAPIError, GarminAuthError, GarminClient
from repository.json_store import JsonActivityStore

# Every step main() runs besides the activities themselves, as the names it
# imports them under. Each module has tests of its own; here they only record
# that they ran.
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
# Run only with a Personal API key.
_PERSONAL_STEP_RESULTS = {"fetch_personal_athlete_metrics": {}}
_PERSONAL_ONLY_STEPS = ["fetch_personal_athlete_metrics", "record_athlete_history", "sync_recovery_history"]


class FakeGarmin:
    """Two running activities known to Garmin by their API summary alone: no
    FIT file, no HR zones, no gear. A test breaks one call for one activity
    through `failures`, keyed by (method name, activity id)."""

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
    """The names of the steps that ran, in order."""
    ran: list[str] = []

    def recorder(name, result):
        def step(*_args, **_kwargs):
            ran.append(name)
            return result

        return step

    for name, result in {**_STEP_RESULTS, **_PERSONAL_STEP_RESULTS}.items():
        monkeypatch.setattr(sync, name, recorder(name, result))
    return ran


def _stored_ids(workspace) -> set[str]:
    return JsonActivityStore(workspace / "activities").get_existing_ids()


def _stored_gear(workspace, activity_id: str) -> str | None:
    stored = JsonActivityStore(workspace / "activities").all_activities()
    return next(a for a in stored if a["id"] == activity_id).get("gearId")


def _store_todays_run(workspace, activity_factory, *, gear_id: str) -> None:
    """A run synced earlier, recent enough for the nightly gear refresh."""
    run = activity_factory("090", date.today().isoformat())
    run.gear_id = gear_id
    store = JsonActivityStore(workspace / "activities")
    store.upsert(run)
    store.save()


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    """A data workspace of its own, and none of the pauses a real run takes."""
    monkeypatch.setenv("RUNOMICS_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
    monkeypatch.delenv("GARMIN_PERSONAL_API_KEY", raising=False)
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


@pytest.fixture
def personal(workspace, monkeypatch) -> FakeGarmin:
    """A Personal API key and no GARMIN_SECRET: the same two activities,
    read through the Personal API."""
    monkeypatch.delenv("GARMIN_SECRET")
    monkeypatch.setenv("GARMIN_PERSONAL_API_KEY", "GCDC_fictional-key")
    fake = FakeGarmin()
    monkeypatch.setattr(sync, "PersonalApiClient", fake)
    monkeypatch.setattr(sync, "GarminClient", _refuse_garmin)
    return fake


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
    """Each step after store.save() writes a file of its own. One of them
    raising used to exit 1 from main(), which made the workflow skip the
    commit and discard the night's activities with the runner."""

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
        # athlete.json is the only copy of what was merged into it; its step
        # must refuse to rewrite it, and nothing else may be held up by that.
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
    """Only a 404 means an activity has no FIT file, HR zones or gear. Anything
    else fails the activity - counted, not saved - so the next run fetches it
    again, where it used to be stored without them for good."""

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
    """Every night re-reads the gear of the last days' runs, to pick up a shoe
    assigned after the first sync. Only a successful answer may change what is
    on file: an error used to come back as "no gear" and write None over it."""

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
        # It used to escape main() before store.save(), taking every
        # activity synced that night with it.
        _store_todays_run(workspace, activity_factory, gear_id="shoe1")
        garmin.failures[("get_activity_gear", "090")] = httpx.ConnectError("connection reset")

        assert _run(monkeypatch) == 0

        assert _stored_ids(workspace) == {"090", "101", "102"}
        assert _stored_gear(workspace, "090") == "shoe1"


def _garmin_whose_gear_request_fails(monkeypatch, error) -> GarminClient:
    """The real client over a fake transport, with no new activity to sync:
    what is under test is its own reading of an error answer."""
    client = object.__new__(GarminClient)
    client._base = "https://example.test"
    client._http = SimpleNamespace(close=lambda: None)

    def get(url, **_kwargs):
        raise error

    client._get = get
    client.get_all_activity_ids = lambda *, running_only=True: []
    monkeypatch.setattr(sync, "GarminClient", lambda _secret: client)
    return client


class TestPersonalApi:
    """With a Personal API key the activities, resting HR and the athlete's
    zones come from it; GARMIN_SECRET, when set, adds what only Connect
    serves, and a dead garth token costs only that."""

    def test_alone_it_syncs_the_activities_resting_hr_and_the_athlete(self, workspace, personal, steps, monkeypatch):
        assert _run(monkeypatch) == 0

        assert _stored_ids(workspace) == {"101", "102"}
        assert steps == _PERSONAL_ONLY_STEPS
        assert "lastSyncedAt" in json.loads((workspace / "sync_meta.json").read_text())

    def test_with_connect_the_activities_still_come_from_the_key_and_the_gear_from_connect(
        self, workspace, personal, garmin, steps, monkeypatch
    ):
        monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
        garmin.details = {}  # read an activity from Connect, and it fails
        garmin.gear = {"101": [{"uuid": "shoe1"}]}
        recovery_sources = []
        monkeypatch.setattr(sync, "sync_recovery_history", recovery_sources.append)

        assert _run(monkeypatch) == 0

        assert _stored_gear(workspace, "101") == "shoe1"
        assert recovery_sources == [personal]
        assert "fetch_personal_athlete_metrics" in steps and steps[-1] == "sync_training_plan"

    def test_a_failed_connect_sign_in_keeps_the_activities_and_exits_3(self, workspace, personal, steps, monkeypatch, capsys):
        def expired(_secret):
            raise GarminAuthError("Token refresh failed")

        monkeypatch.setenv("GARMIN_SECRET", "expired")
        monkeypatch.setattr(sync, "GarminClient", expired)

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert _stored_ids(workspace) == {"101", "102"}
        assert steps == _PERSONAL_ONLY_STEPS
        assert "Garmin Connect sign-in" in capsys.readouterr().out

    def test_without_connect_a_forced_refetch_keeps_the_shoe_on_file(
        self, workspace, personal, steps, monkeypatch, activity_factory
    ):
        run = activity_factory("101", "2026-09-20")
        run.gear_id = "shoe1"
        store = JsonActivityStore(workspace / "activities")
        store.upsert(run)
        store.save()

        assert _run(monkeypatch, "--force") == 0

        assert _stored_gear(workspace, "101") == "shoe1"

    def test_without_either_credential_nothing_reaches_garmin(self, workspace, monkeypatch):
        monkeypatch.delenv("GARMIN_SECRET")
        monkeypatch.setattr(sync, "GarminClient", _refuse_garmin)
        monkeypatch.setattr(sync, "PersonalApiClient", _refuse_garmin)

        assert _run(monkeypatch) == 1


class TestEitherClientCarriesTheNight:
    """Either sign-in may fail while the other reads the runs; the night then
    counts as partial. A Connect error on the gear of a run the key read does
    not cost the run."""

    def test_a_refused_key_falls_back_to_garth_for_everything(self, workspace, garmin, steps, monkeypatch, capsys):
        def refused(_key):
            raise GarminAuthError("Garmin refused GARMIN_PERSONAL_API_KEY (HTTP 401)")

        monkeypatch.setenv("GARMIN_PERSONAL_API_KEY", "GCDC_expired")
        monkeypatch.setattr(sync, "PersonalApiClient", refused)

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert _stored_ids(workspace) == {"101", "102"}
        assert steps == list(_STEP_RESULTS)
        assert "Personal API sign-in failed" in capsys.readouterr().out

    def test_a_malformed_garth_secret_leaves_the_runs_to_the_key(self, workspace, personal, steps, monkeypatch):
        def malformed(_secret):
            raise ValueError("Incorrect padding")

        monkeypatch.setenv("GARMIN_SECRET", "truncated")
        monkeypatch.setattr(sync, "GarminClient", malformed)

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert _stored_ids(workspace) == {"101", "102"}

    def test_a_connect_gear_error_keeps_a_run_the_key_read(
        self, workspace, personal, garmin, steps, monkeypatch, activity_factory
    ):
        monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
        run = activity_factory("101", "2026-09-20")
        run.gear_id = "shoe1"
        store = JsonActivityStore(workspace / "activities")
        store.upsert(run)
        store.save()
        garmin.failures[("get_activity_gear", "101")] = GarminAPIError(403, "https://example.test/gear")
        garmin.failures[("get_activity_gear", "102")] = GarminAPIError(503, "https://example.test/gear")

        assert _run(monkeypatch, "--force") == 0

        assert _stored_ids(workspace) == {"101", "102"}
        assert _stored_gear(workspace, "101") == "shoe1"

    def test_connects_athlete_failure_still_writes_the_keys_values(self, workspace, personal, garmin, steps, monkeypatch):
        monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
        monkeypatch.setattr(sync, "fetch_personal_athlete_metrics", lambda _client: {"lthrBpm": 172})

        def connect_down(_client):
            raise httpx.ConnectError("connection reset")

        monkeypatch.setattr(sync, "fetch_athlete_metrics", connect_down)

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert json.loads((workspace / "athlete.json").read_text())["lthrBpm"] == 172
