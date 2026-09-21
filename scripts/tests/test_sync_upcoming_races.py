from __future__ import annotations

import json

from garmin.client import GarminClient
import sync_upcoming_races as sync_races


class _Response:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def _event(
    event_uuid: str | None,
    event_date: str,
    *,
    event_id: int | None = None,
    primary: bool = False,
    training: bool | None = None,
    goal: object = None,
    distance: float = 10,
    name: str | None = None,
) -> dict:
    event = {
        "shareableEventUuid": event_uuid,
        "date": event_date,
        "eventName": name or f"Race {event_uuid} (10K)",
        "location": "Luxembourg, Luxembourg",
        "race": True,
        "completionTarget": {
            "value": distance,
            "unit": "kilometer",
            "unitType": "distance",
        },
        "eventCustomization": {
            "isPrimaryEvent": primary,
            "isTrainingEvent": not primary if training is None else training,
            "customGoal": goal,
        },
    }
    if event_id is not None:
        event["id"] = event_id
    return event


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


def test_maps_private_race_with_numeric_id_and_all_customization_metadata():
    mapped = sync_races._map_race(
        _event(
            None,
            "2026-10-03",
            event_id=29837036,
            primary=False,
            training=True,
            goal={"unitType": "time", "unit": "second", "value": 1200.0},
            distance=4.97,
            name="Broschtkriibslaf",
        )
    )

    assert mapped == {
        "garminEventId": 29837036,
        "date": "2026-10-03",
        "name": "Broschtkriibslaf",
        "distance": "5K",
        "location": "Luxembourg",
        "isPrimaryEvent": False,
        "isTrainingEvent": True,
        "targetSeconds": 1200,
    }
    assert "garminEventUuid" not in mapped


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


def test_fetch_keeps_private_races_and_deduplicates_by_identity_hierarchy():
    events = [
        # The weaker copy arrives first; UUID preference must be order-independent.
        _event(None, "2026-09-20", event_id=101, name="Shareable Race (10K)"),
        _event(
            "shareable-race",
            "2026-09-20",
            event_id=101,
            name="Shareable Race (10K)",
        ),
        _event(
            None,
            "2026-10-03",
            event_id=29837036,
            primary=False,
            training=True,
            goal={"unitType": "time", "unit": "second", "value": 1200.0},
            distance=4.97,
            name="Broschtkriibslaf",
        ),
        # No Garmin identifier: date/name is the final deterministic fallback.
        _event(None, "2026-10-10", name="Fallback Race"),
        _event(None, "2026-10-10", name=" fallback race "),
    ]

    class Client:
        def get_upcoming_events(self, *, num_days_forward, limit):
            return events

    races = sync_races.fetch_upcoming_races(Client())

    assert len(races) == 3
    assert races[0]["garminEventUuid"] == "shareable-race"
    assert races[0]["garminEventId"] == 101
    private_race = next(
        race for race in races if race.get("garminEventId") == 29837036
    )
    assert private_race["targetSeconds"] == 1200
    assert private_race["isPrimaryEvent"] is False
    assert private_race["isTrainingEvent"] is True
    assert private_race["distance"] == "5K"
    assert "garminEventUuid" not in private_race


def test_distinct_numeric_events_on_same_date_and_name_are_not_deduplicated():
    events = [
        _event(None, "2026-10-03", event_id=1, name="Club Race"),
        _event(None, "2026-10-03", event_id=2, name="Club Race"),
    ]

    class Client:
        def get_upcoming_events(self, *, num_days_forward, limit):
            return events

    races = sync_races.fetch_upcoming_races(Client())

    assert [race["garminEventId"] for race in races] == [1, 2]


def test_write_preserves_omitted_metadata_but_accepts_new_garmin_values(
    tmp_path
):
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
        ],
        data_dir=tmp_path,
    )

    races = json.loads(path.read_text())["races"]
    by_id = {race["garminEventUuid"]: race for race in races}
    assert by_id["preserved"]["targetSeconds"] == 1200
    assert by_id["preserved"]["isPrimaryEvent"] is True
    assert by_id["preserved"]["isTrainingEvent"] is False
    assert "targetSeconds" not in by_id["legacy"]
    assert by_id["updated"]["targetSeconds"] == 2350
    assert by_id["updated"]["isPrimaryEvent"] is False


def test_write_preserves_metadata_for_numeric_and_legacy_date_name_identity(
    tmp_path
):
    path = tmp_path / "upcoming_races.json"
    path.write_text(
        json.dumps(
            {
                "races": [
                    {
                        "garminEventId": 29837036,
                        "date": "2026-10-03",
                        "name": "Broschtkriibslaf",
                        "distance": "5K",
                        "targetSeconds": 1200,
                        "isPrimaryEvent": False,
                        "isTrainingEvent": True,
                    },
                    {
                        "date": "2026-10-10",
                        "name": "Legacy Race",
                        "distance": "10K",
                        "targetSeconds": 2500,
                    },
                ]
            }
        )
    )

    sync_races.write_upcoming_races(
        [
            {
                "garminEventId": 29837036,
                "date": "2026-10-03",
                "name": "Broschtkriibslaf",
                "distance": "5K",
            },
            {
                "garminEventId": 400,
                "date": "2026-10-10",
                "name": "Legacy Race",
                "distance": "10K",
            },
        ],
        data_dir=tmp_path,
    )

    races = json.loads(path.read_text())["races"]
    by_id = {race["garminEventId"]: race for race in races}
    assert by_id[29837036]["targetSeconds"] == 1200
    assert by_id[29837036]["isPrimaryEvent"] is False
    assert by_id[29837036]["isTrainingEvent"] is True
    assert by_id[400]["targetSeconds"] == 2500


def test_map_marks_a_cleared_goal_rather_than_omitting_it():
    """Garmin answering "no goal" has to look different from Garmin saying nothing."""
    cleared = sync_races._map_race(_event("cleared", "2026-10-03", goal=None))
    assert cleared["targetSeconds"] is None

    silent = _event("silent", "2026-10-03")
    del silent["eventCustomization"]
    assert "targetSeconds" not in sync_races._map_race(silent)


def test_map_keeps_a_goal_it_cannot_read_out_of_the_entry():
    """A distance goal is not a cleared goal, so the persisted value must survive it."""
    distance_goal = _event(
        "distance-goal",
        "2026-10-03",
        goal={"unitType": "distance", "unit": "kilometer", "value": 5},
    )
    assert "targetSeconds" not in sync_races._map_race(distance_goal)


def test_write_drops_a_goal_the_athlete_cleared_in_garmin(tmp_path):
    """The regression: clearing a time goal in Garmin never reached the data file."""
    path = tmp_path / "upcoming_races.json"
    path.write_text(
        json.dumps(
            {
                "races": [
                    {
                        "garminEventUuid": "charity-5k",
                        "date": "2026-10-03",
                        "name": "Charity 5K",
                        "distance": "5K",
                        "targetSeconds": 1200,
                        "isPrimaryEvent": False,
                    }
                ]
            }
        )
    )

    sync_races.write_upcoming_races(
        [sync_races._map_race(_event("charity-5k", "2026-10-03", goal=None))],
        data_dir=tmp_path,
    )

    race = json.loads(path.read_text())["races"][0]
    assert "targetSeconds" not in race
    assert race["isPrimaryEvent"] is False


def test_write_still_preserves_a_goal_when_garmin_reports_no_customization(tmp_path):
    """The fallback the clearing fix must not break."""
    path = tmp_path / "upcoming_races.json"
    path.write_text(
        json.dumps(
            {
                "races": [
                    {
                        "garminEventUuid": "silent",
                        "date": "2026-10-03",
                        "name": "Silent",
                        "distance": "5K",
                        "targetSeconds": 1200,
                    }
                ]
            }
        )
    )

    silent = _event("silent", "2026-10-03", name="Silent (5K)", distance=5)
    del silent["eventCustomization"]

    sync_races.write_upcoming_races(
        [sync_races._map_race(silent)],
        data_dir=tmp_path,
    )

    assert json.loads(path.read_text())["races"][0]["targetSeconds"] == 1200
