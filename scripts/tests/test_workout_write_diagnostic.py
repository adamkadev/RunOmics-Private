"""Guards on the disposable Garmin write diagnostic (garmin/test_workout_write.py):
the payload it would send, and its refusal to delete anything that is not the
throwaway test workout."""

import pytest

from garmin.client import GarminAPIError
from garmin.test_workout_write import (
    DURATION_SECS,
    SCHEDULE_DATE,
    WORKOUT_NAME,
    build_payload,
    cleanup,
    create,
)


def _step(payload):
    return payload["workoutSegments"][0]["workoutSteps"][0]


def test_payload_is_one_ten_minute_running_step():
    payload = build_payload()

    assert payload["workoutName"] == WORKOUT_NAME
    assert payload["sportType"]["sportTypeKey"] == "running"
    assert len(payload["workoutSegments"]) == 1
    assert len(payload["workoutSegments"][0]["workoutSteps"]) == 1

    step = _step(payload)
    assert step["type"] == "ExecutableStepDTO"
    assert step["endCondition"]["conditionTypeKey"] == "time"
    assert step["endConditionValue"] == DURATION_SECS == 600


def test_payload_carries_no_pace_or_heart_rate_target():
    step = _step(build_payload())

    assert step["targetType"]["workoutTargetTypeKey"] == "no.target"
    # A stray target value would silently become a pace/HR range on the watch.
    assert "targetValueOne" not in step
    assert "targetValueTwo" not in step


class FakeClient:
    """Records every write it is asked to make, so a test can assert on the
    exact calls rather than on printed output."""

    def __init__(self, *, detail_name=WORKOUT_NAME, calendar_items=()):
        self._detail_name = detail_name
        self._calendar_items = list(calendar_items)
        self.created = []
        self.scheduled = []
        self.unscheduled = []
        self.deleted = []
        self.deleted_workout_ids = set()

    def create_workout(self, payload):
        self.created.append(payload)
        return {"workoutId": 555}

    def schedule_workout(self, workout_id, day):
        self.scheduled.append((workout_id, day))
        return {"workoutScheduleId": 999}

    def unschedule_workout(self, schedule_id):
        self.unscheduled.append(schedule_id)
        self._calendar_items = []

    def delete_workout(self, workout_id):
        self.deleted.append(workout_id)
        self.deleted_workout_ids.add(str(workout_id))

    def get_workout_detail(self, workout_id):
        if str(workout_id) in self.deleted_workout_ids:
            raise GarminAPIError(404, "https://example.test/workout")
        return {"workoutName": self._detail_name}

    def get_calendar_month(self, year, month):
        return {"calendarItems": self._calendar_items}


def _calendar_item(workout_id=555, day=SCHEDULE_DATE):
    return {"id": 777, "itemType": "workout", "workoutId": workout_id, "date": day}


def test_create_schedules_the_new_workout_on_the_test_date():
    client = FakeClient(calendar_items=[_calendar_item()])

    assert create(client) == 0
    assert client.scheduled == [("555", SCHEDULE_DATE)]
    # Creating must never delete or unschedule anything.
    assert client.deleted == []
    assert client.unscheduled == []


def test_create_fails_when_the_workout_never_reaches_the_calendar():
    client = FakeClient(calendar_items=[])

    assert create(client) == 1


def test_cleanup_refuses_a_workout_it_did_not_create():
    client = FakeClient(detail_name="Sortie longue", calendar_items=[_calendar_item()])

    assert cleanup(client, "555") == 2
    assert client.deleted == []
    assert client.unscheduled == []


def test_cleanup_unschedules_then_deletes_only_the_given_workout():
    client = FakeClient(calendar_items=[_calendar_item()])

    assert cleanup(client, "555") == 0
    assert client.unscheduled == ["777"]
    assert client.deleted == ["555"]


def test_cleanup_ignores_calendar_entries_for_other_workouts():
    other = _calendar_item(workout_id=111)
    client = FakeClient(calendar_items=[other, _calendar_item()])

    assert cleanup(client, "555") == 0
    assert client.unscheduled == ["777"]
    assert client.deleted == ["555"]


@pytest.mark.parametrize("name", ["", "runomics api test", "RunOmics API Test 2"])
def test_cleanup_requires_an_exact_name_match(name):
    client = FakeClient(detail_name=name, calendar_items=[_calendar_item()])

    assert cleanup(client, "555") == 2
    assert client.deleted == []
