import json

from garmin.client import GarminClient
import sync_upcoming_races as sync_races


class _Response:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def _event(
    event_uuid: str,
    event_date: str,
    *,
    primary: bool = False,
    goal: object = None,
) -> dict:
    return {
        "shareableEventUuid": event_uuid,
        "date": event_date,
        "eventName": f"Race {event_uuid} (10K)",
        "location": "Luxembourg, Luxembourg",
        "race": True,
        "completionTarget": {"value": 10, "unit": "kilometer"},
        "eventCustomization": {
            "isPrimaryEvent": primary,
            "isTrainingEvent": not primary,
            "customGoal": goal,
        },
    }


def test_client_requests_dedicated_upcoming_events_endpoint():
    client = object.__new__(GarminClient)
    client._base = "https://example.test"
    calls = []

    def get(url, **kwargs):
        calls.append((url, kwargs))
        return _Response([])

    client._get = get

    assert client.get_upcoming_events() == []
    assert calls == [
        (
            "https://example.test/calendar-service/events/upcoming",
            {"params": {"numDaysForward": 365, "limit": 100}},
        )
    ]


def test_maps_primary_training_event_and_custom_time_goal():
    mapped = sync_races._map_race(
        _event(
            "race-1",
            "2026-09-27",
            primary=True,
            goal={"unitType": "time", "unit": "second", "value": 2399.6},
        )
    )

    assert mapped == {
        "garminEventUuid": "race-1",
        "date": "2026-09-27",
        "name": "Race race-1",
        "distance": "10K",
        "location": "Luxembourg",
        "isPrimaryEvent": True,
        "isTrainingEvent": False,
        "targetSeconds": 2400,
    }


def test_non_second_or_non_time_custom_goals_are_not_mapped():
    minute_goal = sync_races._map_race(
        _event(
            "race-1",
            "2026-09-27",
            goal={"unitType": "time", "unit": "minute", "value": 40},
        )
    )
    distance_goal = sync_races._map_race(
        _event(
            "race-2",
            "2026-10-04",
            goal={"unitType": "distance", "unit": "second", "value": 2400},
        )
    )

    assert "targetSeconds" not in minute_goal
    assert "targetSeconds" not in distance_goal


def test_fetch_uses_a_multi_event_limit_and_keeps_all_returned_races(monkeypatch):
    events = [
        _event("race-1", "2026-09-10"),
        _event("race-2", "2026-09-20", primary=True),
        _event("race-3", "2026-09-30"),
        {**_event("training", "2026-09-15"), "race": False},
    ]

    class Client:
        def __init__(self):
            self.args = None

        def get_upcoming_events(self, *, num_days_forward, limit):
            self.args = (num_days_forward, limit)
            return events

    client = Client()
    races = sync_races.fetch_upcoming_races(client)

    assert client.args == (sync_races._FUTURE_DAYS, sync_races._EVENT_LIMIT)
    assert sync_races._EVENT_LIMIT > 1
    assert [race["garminEventUuid"] for race in races] == [
        "race-1",
        "race-2",
        "race-3",
    ]


def test_write_preserves_omitted_metadata_but_accepts_new_garmin_values(
    monkeypatch, tmp_path
):
    monkeypatch.setattr(sync_races, "_DATA_DIR", tmp_path)
    path = tmp_path / "upcoming_races.json"
    path.write_text(
        json.dumps(
            {
                "races": [
                    {
                        "garminEventUuid": "preserved",
                        "date": "2026-09-10",
                        "name": "Preserved",
                        "distance": "5K",
                        "targetSeconds": 1200,
                        "isPrimaryEvent": True,
                        "isTrainingEvent": False,
                    },
                    {
                        "garminEventUuid": "updated",
                        "date": "2026-09-20",
                        "name": "Updated",
                        "distance": "10K",
                        "targetSeconds": 2500,
                        "isPrimaryEvent": True,
                    },
                ]
            }
        )
    )

    sync_races.write_upcoming_races(
        [
            {
                "garminEventUuid": "preserved",
                "date": "2026-09-10",
                "name": "Preserved",
                "distance": "5K",
            },
            {
                "garminEventUuid": "legacy",
                "date": "2026-09-15",
                "name": "Legacy",
                "distance": "5K",
            },
            {
                "garminEventUuid": "updated",
                "date": "2026-09-20",
                "name": "Updated",
                "distance": "10K",
                "targetSeconds": 2350,
                "isPrimaryEvent": False,
            },
        ]
    )

    races = json.loads(path.read_text())["races"]
    by_id = {race["garminEventUuid"]: race for race in races}
    assert by_id["preserved"]["targetSeconds"] == 1200
    assert by_id["preserved"]["isPrimaryEvent"] is True
    assert by_id["preserved"]["isTrainingEvent"] is False
    assert "targetSeconds" not in by_id["legacy"]
    assert by_id["updated"]["targetSeconds"] == 2350
    assert by_id["updated"]["isPrimaryEvent"] is False
