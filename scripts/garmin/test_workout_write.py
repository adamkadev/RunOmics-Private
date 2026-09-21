#!/usr/bin/env python3
"""Disposable diagnostic: prove RunOmics can write a structured workout to
Garmin Connect and put it on the Garmin calendar.

This is a proof-of-concept, not part of any sync. It touches exactly one
throwaway workout named "RunOmics API Test" and one calendar date, and it
reads no coaching data and writes none. It reuses the authenticated session
from garmin/client.py (GARMIN_SECRET, environment only) - there is no second
login flow here.

    python scripts/garmin/test_workout_write.py create
    python scripts/garmin/test_workout_write.py cleanup <workoutId>

`create` never deletes: the workout is left on the calendar so it can be
checked in Garmin Connect and on the watch. `cleanup` refuses to touch any
workout whose name is not exactly "RunOmics API Test", and only ever acts on
the single id given on the command line.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from garmin.client import GarminAPIError, GarminAuthError, GarminClient

# The only workout this script is ever allowed to create, schedule or delete.
WORKOUT_NAME = "RunOmics API Test"
SCHEDULE_DATE = "2026-09-07"
DURATION_SECS = 600  # 10 minutes

_RUNNING = {"sportTypeId": 1, "sportTypeKey": "running", "displayOrder": 1}
_STEP_TYPE_INTERVAL = {"stepTypeId": 3, "stepTypeKey": "interval", "displayOrder": 3}
_END_CONDITION_TIME = {
    "conditionTypeId": 2,
    "conditionTypeKey": "time",
    "displayOrder": 2,
    "displayable": True,
}
_NO_TARGET = {"workoutTargetTypeId": 1, "workoutTargetTypeKey": "no.target", "displayOrder": 1}


def build_payload() -> dict[str, Any]:
    """One running step, 10 minutes, no pace target and no HR target.

    Field shapes follow Garmin's own workout-service DTOs, as returned by
    GET /workout-service/workout/{id} and as used by the community clients
    (cyberjunky/python-garminconnect, st3v/garmin-workouts-mcp).
    """
    step = {
        "stepId": 1,
        "stepOrder": 1,
        "type": "ExecutableStepDTO",
        "stepType": _STEP_TYPE_INTERVAL,
        "description": "",
        "stepAudioNote": None,
        "endCondition": _END_CONDITION_TIME,
        "endConditionValue": DURATION_SECS,
        "targetType": _NO_TARGET,
    }
    return {
        "workoutName": WORKOUT_NAME,
        "sportType": _RUNNING,
        "subSportType": None,
        "estimatedDurationInSecs": DURATION_SECS,
        "estimatedDistanceInMeters": None,
        "estimatedDistanceUnit": {"unitKey": None},
        "avgTrainingSpeed": None,
        "estimateType": None,
        "workoutSegments": [
            {
                "segmentOrder": 1,
                "sportType": _RUNNING,
                "workoutSteps": [step],
            }
        ],
    }


def _calendar_entry(client: GarminClient, workout_id: str, day: str) -> dict[str, Any] | None:
    """The calendar item for `workout_id` on `day`, if Garmin shows one."""
    target = date.fromisoformat(day)
    month = client.get_calendar_month(target.year, target.month)
    for item in month.get("calendarItems", []):
        if item.get("itemType") != "workout":
            continue
        if str(item.get("workoutId") or "") != str(workout_id):
            continue
        if item.get("date") != day:
            continue
        return item
    return None


def create(client: GarminClient) -> int:
    payload = build_payload()
    print(f"POST /workout-service/workout  ({WORKOUT_NAME}, {DURATION_SECS}s, no target)")
    created = client.create_workout(payload)
    workout_id = str(created.get("workoutId") or "")
    if not workout_id:
        print("FAIL: Garmin returned no workoutId.")
        print(json.dumps(created, indent=2)[:2000])
        return 1
    print(f"  workoutId: {workout_id}")

    print(f"POST /workout-service/schedule/{workout_id}  {{\"date\": \"{SCHEDULE_DATE}\"}}")
    scheduled = client.schedule_workout(workout_id, SCHEDULE_DATE)
    schedule_id = scheduled.get("workoutScheduleId") or scheduled.get("id")
    print(f"  workoutScheduleId: {schedule_id if schedule_id else '(none returned)'}")

    print("Verifying against Garmin…")
    detail = client.get_workout_detail(workout_id)
    name_ok = (detail.get("workoutName") or "").strip() == WORKOUT_NAME
    print(f"  workout exists: {name_ok} (name={detail.get('workoutName')!r})")

    entry = _calendar_entry(client, workout_id, SCHEDULE_DATE)
    print(f"  on calendar {SCHEDULE_DATE}: {entry is not None}")

    if name_ok and entry is not None:
        print(f"\nSUCCESS: {WORKOUT_NAME} created and scheduled for {SCHEDULE_DATE}.")
        print(f"Check Garmin Connect > Calendar > {SCHEDULE_DATE}, then sync the watch.")
        print(f"Clean up later with: python {Path(__file__).name} cleanup {workout_id}")
        return 0

    print(f"\nFAIL: workout {workout_id} did not verify as created and scheduled.")
    return 1


def cleanup(client: GarminClient, workout_id: str) -> int:
    detail = client.get_workout_detail(workout_id)
    name = (detail.get("workoutName") or "").strip()
    if name != WORKOUT_NAME:
        print(
            f"REFUSED: workout {workout_id} is named {name!r}, not {WORKOUT_NAME!r}. "
            "Nothing was deleted."
        )
        return 2

    entry = _calendar_entry(client, workout_id, SCHEDULE_DATE)
    if entry is not None:
        schedule_id = str(entry.get("id") or "")
        if schedule_id:
            print(f"DELETE /workout-service/schedule/{schedule_id}")
            client.unschedule_workout(schedule_id)
        else:
            print("  Calendar entry has no id; relying on workout deletion to clear it.")
    else:
        print(f"  No calendar entry on {SCHEDULE_DATE}; nothing to unschedule.")

    print(f"DELETE /workout-service/workout/{workout_id}")
    client.delete_workout(workout_id)

    try:
        client.get_workout_detail(workout_id)
    except GarminAPIError:
        gone = True
    else:
        gone = False
    still_scheduled = _calendar_entry(client, workout_id, SCHEDULE_DATE) is not None

    print(f"  workout deleted: {gone}")
    print(f"  calendar entry cleared: {not still_scheduled}")

    if gone and not still_scheduled:
        print(f"\nSUCCESS: {WORKOUT_NAME} ({workout_id}) removed.")
        return 0
    print(f"\nFAIL: workout {workout_id} is not fully removed.")
    return 1


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("create", help=f"create and schedule {WORKOUT_NAME!r}")
    clean = sub.add_parser("cleanup", help=f"delete one {WORKOUT_NAME!r} workout")
    clean.add_argument("workout_id", help="the single workoutId printed by `create`")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()

    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not secret:
        print("Error: GARMIN_SECRET is not set.", file=sys.stderr)
        print("Load it without shell history:  read -r -s GARMIN_SECRET; export GARMIN_SECRET", file=sys.stderr)
        return 2

    try:
        with GarminClient(secret) as client:
            if args.command == "create":
                return create(client)
            return cleanup(client, args.workout_id)
    except GarminAuthError:
        print("Error: Garmin authentication failed.", file=sys.stderr)
        return 3
    except GarminAPIError as exc:
        # GarminAPIError's message is status + URL only - no token, no payload.
        print(f"Error: Garmin rejected the request: {exc}", file=sys.stderr)
        return 4


if __name__ == "__main__":
    sys.exit(main())
