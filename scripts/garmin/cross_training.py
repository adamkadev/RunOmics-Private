"""Non-running activities as a compact summary each, from the list row alone but a strength session's sets (its FIT)."""

from __future__ import annotations

import time
from collections import Counter
from collections.abc import Callable
from datetime import date, timedelta
from typing import Any, Protocol

from garmin.retry import retry_transient
from processing.mapper import local_start_time
from processing.strength_sets import strength_sets
from repository.cross_training_store import CrossTrainingStore

# Bounds the first night to half a year; the overlap catches a session the watch uploaded days late.
FIRST_BACKFILL_DAYS = 180
OVERLAP_DAYS = 14
_PAGE = 100
_RATE_LIMIT_PAUSE = 1.0
_STRENGTH = "strength_training"
# Recorded as activities on some watches, but no training load.
_NOT_TRAINING = {"breathwork", "meditation"}


class ActivityListSource(Protocol):
    def get_activities(
        self, start: int = 0, limit: int = 100, *, running_only: bool = True, since: str | None = None
    ) -> list[dict[str, Any]]: ...

    def download_fit(self, activity_id: str, *, strict_errors: bool = False) -> bytes | None: ...


def listing_start(newest: str | None, today: date) -> date:
    floor = today - timedelta(days=FIRST_BACKFILL_DAYS)
    if newest is None:
        return floor
    return max(floor, date.fromisoformat(newest) - timedelta(days=OVERLAP_DAYS))


def is_run(row: dict[str, Any]) -> bool:
    kind = row.get("activityType") or {}
    return "run" in str(kind.get("typeKey") or "") or kind.get("typeId") == 1 or kind.get("parentTypeId") == 1


def sport_of(row: dict[str, Any]) -> str:
    return str((row.get("activityType") or {}).get("typeKey") or "other")


def summarize(row: dict[str, Any]) -> dict[str, Any]:
    start = local_start_time(row.get("startTimeLocal"))
    if start is None:
        raise ValueError("the list row has no readable start time")
    duration = row.get("duration") or row.get("elapsedDuration") or 0
    distance = row.get("distance") or 0
    avg_hr = row.get("averageHR")
    load = row.get("activityTrainingLoad")
    return {
        "id": str(row["activityId"]),
        "date": start[:10],
        "startTimeLocal": start,
        "sport": sport_of(row),
        "durationSeconds": round(float(duration)),
        "distanceKm": round(float(distance) / 1000, 2) if float(distance) > 0 else None,
        "avgHeartRate": round(avg_hr) if isinstance(avg_hr, (int, float)) and avg_hr > 0 else None,
        "trainingLoad": round(float(load), 1) if isinstance(load, (int, float)) and load > 0 else None,
    }


def rows_since(client: ActivityListSource, since: date) -> list[dict[str, Any]]:
    day = since.isoformat()
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        batch = retry_transient(client.get_activities, start=start, limit=_PAGE, running_only=False, since=day)
        recent = [row for row in batch or [] if str(row.get("startTimeLocal") or "")[:10] >= day]
        rows += recent
        # A host that ignored the date filter still stops at the first page older than the window.
        if len(batch or []) < _PAGE or not recent:
            return rows
        start += _PAGE


def sync_cross_training(
    client: ActivityListSource,
    run_ids: set[str],
    *,
    today: date | None = None,
    store: CrossTrainingStore | None = None,
    pause: Callable[[float], None] | None = None,
) -> int:
    """Store tonight's new sessions; a session that fails is left for the next night, and the step then raises."""
    store = store or CrossTrainingStore()
    since = listing_start(store.newest_date(), today or date.today())
    print(f"Syncing cross-training since {since.isoformat()}…")
    rows = rows_since(client, since)
    retyped = store.remove(run_ids)

    known = store.ids() | run_ids
    candidates = [
        row for row in rows
        if row.get("activityId") is not None and str(row["activityId"]) not in known
        and not is_run(row) and sport_of(row) not in _NOT_TRAINING
    ]
    candidates.sort(key=lambda row: str(row.get("startTimeLocal") or ""))

    stored: Counter[str] = Counter()
    with_sets = failed = 0
    for row in candidates:
        try:
            session = summarize(row)
            if session["sport"] == _STRENGTH:
                fit = retry_transient(client.download_fit, session["id"])
                (pause or time.sleep)(_RATE_LIMIT_PAUSE)
                sets = strength_sets(fit) if fit else []
                if sets:
                    session["sets"] = sets
                    with_sets += 1
        except Exception as exc:
            failed += 1
            print(f"  Warning: a {sport_of(row)} session was not stored ({type(exc).__name__}); the next sync retries it.")
            continue
        store.upsert(session)
        stored[session["sport"]] += 1

    store.save()
    kinds = ", ".join(f"{sport} {count}" for sport, count in sorted(stored.items()))
    print(f"  {sum(stored.values())} new session(s){f' ({kinds})' if kinds else ''}, {with_sets} with sets"
          f"{f', {retyped} now a run' if retyped else ''}; {len(store.ids())} stored.")
    if failed:
        raise RuntimeError(f"{failed} of {len(candidates)} cross-training session(s) failed")
    return sum(stored.values())
