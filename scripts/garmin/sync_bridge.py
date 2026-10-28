#!/usr/bin/env python3
"""Garmin transport for `npm run coach:sync-garmin`: every sync decision lives in TypeScript, this only makes HTTP calls."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from garmin.auth import NOT_A_SECRET
from garmin.client import GarminAPIError, GarminAuthError, GarminClient

_MANAGED_ITEM_TYPE = "workout"


def _dispatch(client: GarminClient, request: dict[str, Any]) -> dict[str, Any]:
    op = request.get("op")

    if op == "create":
        created = client.create_workout(request["payload"])
        workout_id = created.get("workoutId")
        if not workout_id:
            return {"ok": False, "error": "Garmin returned no workoutId"}
        return {"ok": True, "workoutId": str(workout_id)}

    if op == "schedule":
        scheduled = client.schedule_workout(request["workoutId"], request["date"])
        schedule_id = scheduled.get("workoutScheduleId") or scheduled.get("id")
        if not schedule_id:
            return {"ok": False, "error": "Garmin returned no workoutScheduleId"}
        return {"ok": True, "workoutScheduleId": str(schedule_id)}

    if op == "unschedule":
        client.unschedule_workout(request["scheduleId"])
        return {"ok": True}

    if op == "delete":
        client.delete_workout(request["workoutId"])
        return {"ok": True}

    if op == "get":
        try:
            detail = client.get_workout_detail(request["workoutId"])
        except GarminAPIError as exc:
            if exc.status_code == 404:
                return {"ok": True, "workout": None}
            raise
        return {
            "ok": True,
            "workout": {
                "workoutId": str(detail.get("workoutId") or request["workoutId"]),
                "workoutName": detail.get("workoutName") or "",
            },
        }

    if op == "scheduled":
        month = client.get_calendar_month(int(request["year"]), int(request["month"]))
        items = [
            {
                "scheduleId": str(item.get("id") or ""),
                "workoutId": str(item.get("workoutId") or ""),
                "date": item.get("date") or "",
            }
            for item in month.get("calendarItems", [])
            if item.get("itemType") == _MANAGED_ITEM_TYPE and item.get("workoutId")
        ]
        return {"ok": True, "items": items}

    if op == "auth":
        return {"ok": True, **client.auth_state()}

    return {"ok": False, "error": f"Unknown operation: {op!r}"}


def _emit(response: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()


def _serve(client: GarminClient) -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            _emit({"ok": False, "error": "Malformed request"})
            continue

        try:
            _emit(_dispatch(client, request))
        except GarminAPIError as exc:
            # The message is status + URL only; no token and no payload.
            _emit({"ok": False, "error": str(exc), "rateLimited": exc.status_code == 429})
        except Exception as exc:
            _emit({"ok": False, "error": f"{type(exc).__name__}: {exc}"})


def main() -> int:
    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not secret:
        _emit({"ok": False, "error": "GARMIN_SECRET is not set"})
        return 2

    try:
        with GarminClient(secret) as client:
            _serve(client)
    except GarminAuthError:
        _emit({"ok": False, "error": "Garmin authentication failed"})
        return 3
    except ValueError:
        _emit({"ok": False, "error": NOT_A_SECRET})
        return 3

    return 0


if __name__ == "__main__":
    sys.exit(main())
