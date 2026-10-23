from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from data_directory import get_data_dir
from processing.mapper import ActivityData
from repository.atomic_write import write_text_atomic
from repository.history_file import HistoryFileError, read_history


def _year_of(date: str) -> str | None:
    return date[:4] if len(date) >= 4 else None


def _month_of(date: str) -> str | None:
    return date[:7] if len(date) >= 7 else None


def _read_entries(path: Path, key: str, id_field: str) -> list[dict[str, Any]]:
    """Both stores rewrite every dirty file from memory on save(): a skipped file would return with only this sync's entries."""
    entries = read_history(path).get(key, [])
    if not isinstance(entries, list) or not all(
        isinstance(entry, dict) and id_field in entry for entry in entries
    ):
        raise HistoryFileError(
            f"{path}[{key!r}] is not a list of entries that each carry {id_field!r}. "
            f"Refusing to continue: the next save would rewrite this file. Restore it "
            f"from the data repository's git history, then re-run."
        )
    return entries


def _atomic_write_json(path: Path, data: dict[str, Any]) -> None:
    # No trailing newline, so existing files keep their bytes.
    write_text_atomic(path, json.dumps(data, indent=2, ensure_ascii=False))


class JsonActivityStore:
    """Monthly rather than yearly: with their sample arrays a year file reaches ~7 MB, and closed months never move again."""

    def __init__(self, dir_path: Path | None = None) -> None:
        self._dir = dir_path or get_data_dir() / "activities"
        self._by_id: dict[str, dict[str, Any]] = {}
        self._dirty_months: set[str] = set()
        self._load()

    def get_existing_ids(self) -> set[str]:
        return set(self._by_id.keys())

    def get_ids_since(self, days: int) -> list[str]:
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        return [aid for aid, a in self._by_id.items() if a.get("date", "") >= cutoff]

    def all_activities(self) -> list[dict[str, Any]]:
        return list(self._by_id.values())

    def touch(self, activity_id: str) -> None:
        month = _month_of(self._by_id[activity_id].get("date", ""))
        if month:
            self._dirty_months.add(month)

    def update_gear(self, activity_id: str, gear_id: str | None) -> bool:
        activity = self._by_id.get(activity_id)
        if activity is None or activity.get("gearId") == gear_id:
            return False
        activity["gearId"] = gear_id
        self.touch(activity_id)
        return True

    def upsert(self, activity: ActivityData, *, replace: bool = False) -> bool:
        new_dict = activity.to_dict()
        existing = self._by_id.get(activity.id)
        if existing is not None:
            # Typed into the data repository and never sent back by Garmin: no re-fetch may drop them, replace included.
            new_dict["comment"] = existing.get("comment", "")
            if existing.get("rpe") is not None:
                new_dict["rpe"] = existing["rpe"]
            # Weather can be re-derived (backfill_weather.py), so replace starts it over.
            if not replace and new_dict.get("weather") is None:
                new_dict["weather"] = existing.get("weather")

        self._by_id[activity.id] = new_dict
        self.touch(activity.id)
        return existing is None

    def save(self) -> None:
        if not self._dirty_months:
            return

        by_month: dict[str, list[dict[str, Any]]] = {}
        for activity in self._by_id.values():
            month = _month_of(activity.get("date", ""))
            if month:
                by_month.setdefault(month, []).append(activity)

        self._dir.mkdir(parents=True, exist_ok=True)
        for month in self._dirty_months:
            activities = sorted(by_month.get(month, []), key=lambda a: a.get("date", ""), reverse=True)
            _atomic_write_json(self._dir / f"{month}.json", {"activities": activities})
        self._dirty_months.clear()

        _atomic_write_json(self._dir / "index.json", {"months": sorted(by_month.keys(), reverse=True)})

    def count(self) -> int:
        return len(self._by_id)

    def _load(self) -> None:
        if not self._dir.exists():
            return
        for path in sorted(self._dir.glob("*.json")):
            if path.name == "index.json":
                continue
            for activity in _read_entries(path, "activities", "id"):
                self._by_id[activity["id"]] = activity


class PlannedWorkoutStore:
    """Sorted oldest first to match sync_workouts.py, unlike JsonActivityStore; a year is ~26 KB, so yearly files suffice."""

    def __init__(self, dir_path: Path | None = None) -> None:
        self._dir = dir_path or get_data_dir() / "planned_workouts"
        self._by_date: dict[str, dict[str, Any]] = {}
        self._dirty_years: set[str] = set()
        self._load()

    def get(self, date: str) -> dict[str, Any] | None:
        return self._by_date.get(date)

    def all_entries(self) -> list[dict[str, Any]]:
        return list(self._by_date.values())

    def upsert(self, entry: dict[str, Any]) -> None:
        self._by_date[entry["date"]] = entry
        year = _year_of(entry["date"])
        if year:
            self._dirty_years.add(year)

    def delete(self, date: str) -> None:
        if date not in self._by_date:
            return
        del self._by_date[date]
        year = _year_of(date)
        if year:
            self._dirty_years.add(year)

    def count(self) -> int:
        return len(self._by_date)

    def save(self) -> None:
        if not self._dirty_years:
            return

        by_year: dict[str, list[dict[str, Any]]] = {}
        for entry in self._by_date.values():
            year = _year_of(entry.get("date", ""))
            if year:
                by_year.setdefault(year, []).append(entry)

        self._dir.mkdir(parents=True, exist_ok=True)
        for year in self._dirty_years:
            entries = sorted(by_year.get(year, []), key=lambda e: e.get("date", ""))
            _atomic_write_json(self._dir / f"{year}.json", {"planned": entries})
        self._dirty_years.clear()

        _atomic_write_json(self._dir / "index.json", {"years": sorted(by_year.keys(), reverse=True)})

    def _load(self) -> None:
        if not self._dir.exists():
            return
        for path in sorted(self._dir.glob("*.json")):
            if path.name == "index.json":
                continue
            for entry in _read_entries(path, "planned", "date"):
                self._by_date[entry["date"]] = entry
