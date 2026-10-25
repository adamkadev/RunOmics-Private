import json
from datetime import date, datetime, timezone

import pytest
from garmin_fit_sdk import Encoder, Profile

from garmin.client import GarminAPIError
from garmin.cross_training import sync_cross_training
from repository.cross_training_store import CrossTrainingStore

TODAY = date(2026, 10, 25)


def _row(activity_id: int, start: str, type_key: str, **extra) -> dict:
    return {"activityId": activity_id, "startTimeLocal": start, "activityType": {"typeKey": type_key}, **extra}


def _strength_fit() -> bytes:
    number = {message["name"]: num for num, message in Profile["messages"].items()}
    at = datetime(2026, 10, 20, 18, 0, tzinfo=timezone.utc)
    encoder = Encoder()
    encoder.on_mesg(number["file_id"], {"type": "activity", "manufacturer": "garmin", "product": 1, "time_created": at})
    encoder.on_mesg(number["set"], {
        "timestamp": at, "duration": 45.4, "repetitions": 12, "weight": 16.0, "set_type": "active",
        "category": ["squat"], "category_subtype": [37], "message_index": 0,
    })
    encoder.on_mesg(number["set"], {"timestamp": at, "duration": 60.0, "set_type": "rest", "message_index": 1})
    encoder.on_mesg(number["set"], {
        "timestamp": at, "duration": 30.0, "repetitions": 10, "set_type": "active", "category": ["unknown"], "message_index": 2,
    })
    return encoder.close()


class FakeList:
    def __init__(self, rows: list[dict], fits: dict[str, bytes | Exception | None] | None = None) -> None:
        self.rows = rows
        self.fits = fits or {}
        self.asked_since: list[str | None] = []
        self.downloads: list[str] = []

    def get_activities(self, start=0, limit=100, *, running_only=True, since=None):
        assert not running_only
        self.asked_since.append(since)
        return self.rows[start:start + limit]

    def download_fit(self, activity_id, *, strict_errors=False):
        self.downloads.append(activity_id)
        fit = self.fits.get(activity_id)
        if isinstance(fit, Exception):
            raise fit
        return fit


def _run(client: FakeList, tmp_path, run_ids: set[str] = frozenset(), today: date = TODAY) -> int:
    return sync_cross_training(client, set(run_ids), today=today, store=CrossTrainingStore(tmp_path), pause=lambda _s: None)


def test_a_night_stores_each_non_running_session_with_a_strength_sessions_sets_and_never_a_run(tmp_path, capsys):
    client = FakeList(
        [
            _row(5, "2026-10-21 07:00:00", "running"),
            _row(4, "2026-10-20 18:00:00", "strength_training", duration=2712.6, averageHR=104.4, activityTrainingLoad=31.26),
            _row(3, "2026-10-19 12:00:00", "road_biking", duration=3600.0, distance=30150.0, averageHR=131.0),
            _row(1, "2026-10-17 07:00:00", "trail_running"),
        ],
        fits={"4": _strength_fit()},
    )

    assert _run(client, tmp_path, run_ids={"5"}) == 2

    written = json.loads((tmp_path / "2026.json").read_text())["sessions"]
    assert written == [
        {
            "id": "4", "date": "2026-10-20", "startTimeLocal": "2026-10-20T18:00:00", "sport": "strength_training",
            "durationSeconds": 2713, "distanceKm": None, "avgHeartRate": 104, "trainingLoad": 31.3,
            "sets": [
                {"category": "squat", "exercise": "goblet_squat", "reps": 12, "weightKg": 16.0, "durationSeconds": 45},
                {"reps": 10, "durationSeconds": 30},
            ],
        },
        {
            "id": "3", "date": "2026-10-19", "startTimeLocal": "2026-10-19T12:00:00", "sport": "road_biking",
            "durationSeconds": 3600, "distanceKm": 30.15, "avgHeartRate": 131, "trainingLoad": None,
        },
    ]
    assert json.loads((tmp_path / "index.json").read_text()) == {"years": ["2026"]}
    assert client.downloads == ["4"]
    out = capsys.readouterr().out
    assert "road_biking 1, strength_training 1" in out
    assert not any(value in out for value in ("104", "131", "31.3", "16.0"))


def test_the_first_night_reads_half_a_year_and_later_ones_a_fortnight_before_the_newest(tmp_path):
    first = FakeList([_row(1, "2026-10-01 18:00:00", "cycling", duration=1800.0)])
    _run(first, tmp_path)
    later = FakeList([])
    _run(later, tmp_path)

    assert first.asked_since == ["2026-04-28"]
    assert later.asked_since == ["2026-09-17"]


def test_a_host_that_ignores_the_date_filter_is_read_no_further_than_the_window(tmp_path):
    rows = [_row(i, "2025-01-01 08:00:00", "cycling") for i in range(250)]
    client = FakeList(rows)

    assert _run(client, tmp_path) == 0
    assert len(client.asked_since) == 1


def test_a_failed_download_leaves_that_session_for_the_next_night_keeps_the_others_and_fails_the_step(tmp_path):
    client = FakeList(
        [_row(2, "2026-10-20 18:00:00", "strength_training"), _row(1, "2026-10-19 18:00:00", "yoga", duration=1800.0)],
        fits={"2": GarminAPIError(400, "https://example.test/download"), "1": None},
    )

    with pytest.raises(RuntimeError, match="1 of 2"):
        _run(client, tmp_path)

    assert CrossTrainingStore(tmp_path).ids() == {"1"}
    client.fits["2"] = None
    assert _run(client, tmp_path) == 1
    assert CrossTrainingStore(tmp_path).ids() == {"1", "2"}


def test_a_session_retyped_as_a_run_leaves_the_store(tmp_path):
    _run(FakeList([_row(1, "2026-10-19 18:00:00", "cardio", duration=1800.0)]), tmp_path)

    _run(FakeList([]), tmp_path, run_ids={"1"})

    assert CrossTrainingStore(tmp_path).ids() == set()
    assert not (tmp_path / "2026.json").exists()
    assert json.loads((tmp_path / "index.json").read_text()) == {"years": []}
