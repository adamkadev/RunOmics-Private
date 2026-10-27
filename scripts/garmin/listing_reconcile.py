"""Stored runs kept in step with Garmin's activity list: a run deleted or re-typed there leaves, a rename follows."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, Protocol

from data_directory import get_data_dir
from garmin.cross_training import is_run, sport_of
from garmin.errors import GarminAPIError
from garmin.retry import retry_transient
from processing.mapper import clean_activity_name
from repository.history_file import read_history, write_history
from repository.json_store import JsonActivityStore

_REMOVED_PATH = get_data_dir() / "removed_activities.json"
MAX_REMOVALS_PER_NIGHT = 5
# More missing runs than this is a list Garmin cut short, not a night of deletions.
TRUNCATED_MISSING = 20


class ActivityDetailSource(Protocol):
    def get_activity_detail(self, activity_id: str) -> dict[str, Any]: ...


@dataclass
class Removal:
    removed: list[dict[str, Any]] = field(default_factory=list)
    problem: str | None = None

    def retyped_since(self) -> date | None:
        days = [entry["date"] for entry in self.removed if entry["reason"] != "deleted" and entry.get("date")]
        return date.fromisoformat(min(days)) if days else None


def remove_missing_runs(
    client: ActivityDetailSource,
    store: JsonActivityStore,
    rows: dict[str, dict[str, Any]],
    *,
    today: date | None = None,
    path: Path | None = None,
) -> Removal:
    """Only after a complete listing: `rows` is every activity Garmin lists, a page cut short reads as deletions."""
    stored = {run["id"]: run for run in store.all_activities()}
    missing = sorted((aid for aid in stored if aid not in rows), key=lambda aid: stored[aid].get("date", ""), reverse=True)
    if not missing:
        return Removal()
    if not rows or len(missing) > TRUNCATED_MISSING:
        print(f"Warning: {len(missing)} stored run(s) are not in Garmin's list of {len(rows)}, which looks cut short; "
              f"none is removed.")
        return Removal(problem="the activity list looks truncated")

    print(f"{len(missing)} stored run(s) are no longer in Garmin's list of runs; checking each…")
    removal = Removal()
    unsure = 0
    for activity_id in missing[:MAX_REMOVALS_PER_NIGHT]:
        try:
            reason = _why_missing(client, activity_id)
        except Exception as exc:
            print(f"  Warning: run {activity_id} kept ({type(exc).__name__}: {exc}).")
            unsure += 1
            continue
        run = store.remove(activity_id) or {}
        removal.removed.append({
            "id": activity_id,
            "date": run.get("date"),
            "name": run.get("description"),
            "distanceKm": run.get("distanceKm"),
            "reason": reason,
            "removedOn": (today or date.today()).isoformat(),
        })
        print(f"  Removed run {activity_id} of {run.get('date')}: {reason}.")
    if len(missing) > MAX_REMOVALS_PER_NIGHT:
        print(f"  {len(missing) - MAX_REMOVALS_PER_NIGHT} more are left for the next nights.")

    if removal.removed:
        target = path or _REMOVED_PATH
        tombstones = read_history(target).get("removed") or []
        write_history(target, {"removed": [*tombstones, *removal.removed]})
    if unsure:
        removal.problem = f"{unsure} run(s) missing from the activity list"
    return removal


def _why_missing(client: ActivityDetailSource, activity_id: str) -> str:
    try:
        detail = retry_transient(client.get_activity_detail, activity_id)
    except GarminAPIError as exc:
        if exc.status_code == 404:
            return "deleted"
        raise
    row = {"activityType": detail.get("activityTypeDTO") or detail.get("activityType") or {}}
    if not row["activityType"].get("typeKey"):
        raise ValueError("Garmin's answer names no activity type")
    if is_run(row):
        raise ValueError("Garmin still has it as a run, so the list missed it")
    return f"retyped:{sport_of(row)}"


def refresh_names(
    store: JsonActivityStore,
    rows: dict[str, dict[str, Any]],
    *,
    describe: Callable[[str, str], str],
    retype: Callable[[dict[str, Any]], dict[str, Any] | None],
) -> int:
    """describe(listed name, date) is the description a sync would store; retype(run) its type fields, None to keep them."""
    renamed = 0
    for run in store.all_activities():
        row = rows.get(run["id"])
        name = clean_activity_name(row.get("activityName")) if row else ""
        if not name:
            continue
        description = describe(name, run.get("date", ""))
        if description == run.get("description"):
            continue
        renamed_run = {**run, "description": description}
        store.update(run["id"], {"description": description, **(retype(renamed_run) or {})})
        renamed += 1
    return renamed
