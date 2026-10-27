"""The workflow acts on the exit code: 0 clean, 3 partial ("commit what succeeded, then fail"), else a stop before the commit."""

import copy
import json
import sys
from datetime import date
from types import SimpleNamespace

import httpx
import pytest

import sync
from garmin.client import GarminAPIError, GarminAuthError, GarminClient, GarminTokenExpired
from repository.json_store import JsonActivityStore

# Every step main() runs besides the activities, under the names it imports them as; here they only record that they ran.
_STEP_RESULTS = {
    "fetch_planned_workouts": ([], set()),
    "write_planned_workouts": None,
    "sync_cross_training": 0,
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
_PERSONAL_STEP_RESULTS = {"fetch_personal_athlete_metrics": {}, "sync_vo2max_from_runs": 0}
_PERSONAL_ONLY_STEPS = [
    "sync_cross_training", "sync_vo2max_from_runs", "fetch_personal_athlete_metrics", "record_athlete_history",
    "sync_recovery_history",
]


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

    def get_activity_starts(self, *, running_only: bool = True) -> dict[str, str | None]:
        return {aid: detail.get("startTimeLocal") for aid, detail in self.details.items()}

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
            # A copy: main() may add to what a step returns, and the table is
            # shared by every test.
            return copy.deepcopy(result)

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
    run = activity_factory("090", date.today().isoformat())
    run.gear_id = gear_id
    store = JsonActivityStore(workspace / "activities")
    store.upsert(run)
    store.save()


@pytest.fixture
def workspace(tmp_path, monkeypatch):
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

    def test_a_new_run_keeps_its_start_and_a_stored_one_gets_it_from_the_list(
        self, workspace, garmin, steps, monkeypatch, activity_factory
    ):
        store = JsonActivityStore(workspace / "activities")
        store.upsert(activity_factory("101", "2026-09-20"))
        store.save()

        assert _run(monkeypatch) == 0

        stored = {a["id"]: a for a in JsonActivityStore(workspace / "activities").all_activities()}
        assert stored["101"]["startTimeLocal"] == "2026-09-20T07:00:00"
        assert stored["102"]["startTimeLocal"] == "2026-09-21T18:30:00"

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

    def test_a_run_quick_synced_gets_its_shoe_from_the_next_full_sync_however_old(
        self, workspace, personal, garmin, steps, monkeypatch
    ):
        monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
        assert _run(monkeypatch, "--quick") == 0
        garmin.gear = {"101": [{"uuid": "shoe1"}]}

        assert _run(monkeypatch) == 0

        assert _stored_gear(workspace, "101") == "shoe1"
        assert JsonActivityStore(workspace / "activities").get_gear_pending_ids() == []


def _garmin_whose_gear_request_fails(monkeypatch, error) -> GarminClient:
    """The real client over a fake transport: what is under test is its own reading of an error answer."""
    client = object.__new__(GarminClient)
    client._base = "https://example.test"
    client._http = SimpleNamespace(close=lambda: None)

    def get(url, **_kwargs):
        raise error

    client._get = get
    client.get_activity_starts = lambda *, running_only=True: {}
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

    def test_a_quick_sync_leaves_connect_to_the_next_full_one_and_exits_0(self, workspace, personal, steps, monkeypatch):
        monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")

        assert _run(monkeypatch, "--quick") == 0

        assert _stored_ids(workspace) == {"101", "102"}
        assert steps == _PERSONAL_ONLY_STEPS

    def test_a_quick_sync_whose_key_is_refused_stops_rather_than_open_connect(self, workspace, personal, monkeypatch):
        def refused(_key):
            raise GarminAuthError("Garmin refused GARMIN_PERSONAL_API_KEY (HTTP 401)")

        monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
        monkeypatch.setattr(sync, "PersonalApiClient", refused)

        with pytest.raises(GarminAuthError):
            _run(monkeypatch, "--quick")

    def test_without_a_key_a_quick_sync_is_a_full_one(self, workspace, garmin, steps, monkeypatch):
        assert _run(monkeypatch, "--quick") == 0

        assert steps == list(_STEP_RESULTS)

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

    def test_a_connect_gear_error_keeps_the_runs_the_key_read_and_reports_it(
        self, workspace, personal, garmin, steps, monkeypatch, activity_factory, capsys
    ):
        monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
        run = activity_factory("101", "2026-09-20")
        run.gear_id = "shoe1"
        store = JsonActivityStore(workspace / "activities")
        store.upsert(run)
        store.save()
        asked = []

        def gear_down(activity_id, **_kwargs):
            asked.append(activity_id)
            raise GarminAPIError(503, "https://example.test/gear")

        monkeypatch.setattr(garmin, "get_activity_gear", gear_down)

        assert _run(monkeypatch, "--force") == sync._EXIT_PARTIAL_FAILURE

        assert _stored_ids(workspace) == {"101", "102"}
        assert _stored_gear(workspace, "101") == "shoe1"
        # Asked for the first run only (its retries included), not once per
        # run: each ask waits through the retries.
        assert set(asked) == {"101"}
        assert "gear of 2 run(s)" in capsys.readouterr().out

    def test_connects_athlete_failure_still_writes_the_keys_values(self, workspace, personal, garmin, steps, monkeypatch):
        monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
        monkeypatch.setattr(sync, "fetch_personal_athlete_metrics", lambda _client: {"lthrBpm": 172})

        def connect_down(_client):
            raise httpx.ConnectError("connection reset")

        monkeypatch.setattr(sync, "fetch_athlete_metrics", connect_down)

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert json.loads((workspace / "athlete.json").read_text())["lthrBpm"] == 172


class TestVo2maxWithoutConnect:
    """The athlete's VO2max follows the series the runs carry on - only once a
    run newer than Connect's last sample has moved it."""

    @pytest.fixture
    def history(self, workspace, monkeypatch):
        from garmin import vo2max_history

        path = workspace / "vo2max_history.json"
        monkeypatch.setattr(vo2max_history, "_OUT_PATH", path)
        monkeypatch.setattr(sync, "sync_vo2max_from_runs", vo2max_history.sync_vo2max_from_runs)
        (workspace / "athlete.json").write_text(json.dumps({"vo2maxMlKgMin": 38.0, "vmaKmh": 10.9}))
        return path

    def _store_run(self, workspace, activity_factory, day, vo2max):
        run = activity_factory("090", day)
        run.vo2max_garmin = vo2max
        store = JsonActivityStore(workspace / "activities")
        store.upsert(run)
        store.save()

    def test_a_run_after_connects_last_sample_moves_it(self, workspace, personal, steps, monkeypatch, activity_factory, history):
        history.write_text(json.dumps({"months": {"2026-09": {"date": "2026-09-15", "vo2max": 37.6}}, "days": {}}))
        self._store_run(workspace, activity_factory, "2026-09-25", 37.3)

        assert _run(monkeypatch) == 0

        athlete = json.loads((workspace / "athlete.json").read_text())
        assert (athlete["vo2maxMlKgMin"], athlete["vmaKmh"]) == (37.0, 10.6)

    def test_without_a_newer_run_connects_value_stays(self, workspace, personal, steps, monkeypatch, activity_factory, history):
        history.write_text(json.dumps({"months": {"2026-09": {"date": "2026-09-30", "vo2max": 37.6}}, "days": {}}))
        self._store_run(workspace, activity_factory, "2026-09-25", 37.3)

        assert _run(monkeypatch) == 0

        athlete = json.loads((workspace / "athlete.json").read_text())
        assert (athlete["vo2maxMlKgMin"], athlete["vmaKmh"]) == (38.0, 10.9)


def _expired(_secret):
    raise GarminTokenExpired("Token refresh failed: 401 Client Error")


def _connect_status(workspace) -> dict:
    return json.loads((workspace / "connect_status.json").read_text())


class TestExpiredConnect:
    """Once garth's token has died, Connect is absent rather than failing: the night is clean, and it says so once."""

    def test_the_runs_come_from_the_key_the_night_is_clean_and_the_expiry_is_recorded(
        self, workspace, personal, steps, monkeypatch, capsys
    ):
        monkeypatch.setenv("GARMIN_SECRET", "expired")
        monkeypatch.setattr(sync, "GarminClient", _expired)

        assert _run(monkeypatch) == 0

        assert _stored_ids(workspace) == {"101", "102"}
        assert steps == _PERSONAL_ONLY_STEPS
        assert _connect_status(workspace) == {"state": "expired", "since": date.today().isoformat()}
        assert "Garmin Connect sign-in" not in capsys.readouterr().out

    def test_no_new_run_waits_for_a_shoe_connect_will_never_send(self, workspace, personal, steps, monkeypatch):
        monkeypatch.setenv("GARMIN_SECRET", "expired")
        monkeypatch.setattr(sync, "GarminClient", _expired)

        assert _run(monkeypatch) == 0

        assert JsonActivityStore(workspace / "activities").get_gear_pending_ids() == []

    def test_later_nights_keep_the_day_it_was_first_found(self, workspace, personal, steps, monkeypatch):
        (workspace / "connect_status.json").write_text('{"state": "expired", "since": "2026-11-03"}')
        monkeypatch.setenv("GARMIN_SECRET", "expired")
        monkeypatch.setattr(sync, "GarminClient", _expired)

        assert _run(monkeypatch) == 0

        assert _connect_status(workspace)["since"] == "2026-11-03"

    def test_a_new_token_brings_connect_back(self, workspace, personal, garmin, steps, monkeypatch):
        (workspace / "connect_status.json").write_text('{"state": "expired", "since": "2026-11-03"}')
        monkeypatch.setenv("GARMIN_SECRET", "renewed")

        assert _run(monkeypatch) == 0

        assert _connect_status(workspace)["state"] == "active"
        assert steps[-1] == "sync_training_plan"

    def test_a_connect_that_signs_in_writes_no_status(self, workspace, garmin, steps, monkeypatch):
        assert _run(monkeypatch) == 0

        assert not (workspace / "connect_status.json").exists()

    def test_another_sign_in_failure_is_still_a_partial_night_and_not_an_expiry(
        self, workspace, personal, steps, monkeypatch
    ):
        def unreachable(_secret):
            raise GarminAuthError("Token refresh failed: 403 Forbidden")

        monkeypatch.setenv("GARMIN_SECRET", "not-a-real-token")
        monkeypatch.setattr(sync, "GarminClient", unreachable)

        assert _run(monkeypatch) == sync._EXIT_PARTIAL_FAILURE

        assert not (workspace / "connect_status.json").exists()

    def test_a_dry_run_records_nothing(self, workspace, personal, steps, monkeypatch):
        monkeypatch.setenv("GARMIN_SECRET", "expired")
        monkeypatch.setattr(sync, "GarminClient", _expired)

        assert _run(monkeypatch, "--dry-run") == 0

        assert not (workspace / "connect_status.json").exists()

    def test_without_a_key_nothing_can_read_the_runs_so_it_stops_with_the_expiry_recorded(
        self, workspace, monkeypatch
    ):
        monkeypatch.setattr(sync, "GarminClient", _expired)

        with pytest.raises(GarminTokenExpired):
            _run(monkeypatch)

        assert _connect_status(workspace)["state"] == "expired"
