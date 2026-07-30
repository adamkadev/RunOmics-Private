from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from processing.mapper import ActivityData

_DEFAULT_DIR = Path(__file__).resolve().parents[2] / "public" / "data" / "activities"
_PLANNED_DEFAULT_DIR = Path(__file__).resolve().parents[2] / "public" / "data" / "planned_workouts"


def _year_of(date: str) -> str | None:
    return date[:4] if len(date) >= 4 else None


def _month_of(date: str) -> str | None:
    return date[:7] if len(date) >= 7 else None


def _atomic_write_json(path: Path, data: dict[str, Any]) -> None:
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


class JsonActivityStore:
    """Activities are stored one JSON file per month (`<dir>/<YYYY-MM>.json`) plus
    an `index.json` manifest of available months, so a sync only rewrites the
    file(s) for the month(s) it actually touched.

    Monthly rather than yearly: activities carry downsampled sample arrays, so a
    year file reaches ~7 MB by December and every sync rewrote it wholesale. A
    month is ~600 KB and closed months never move again."""

    def __init__(self, dir_path: Path = _DEFAULT_DIR) -> None:
        self._dir = dir_path
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
        if existing is not None and not replace:
            new_dict["rpe"] = existing.get("rpe", new_dict["rpe"])
            new_dict["comment"] = existing.get("comment", "")
            if new_dict.get("weather") is None:
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
            try:
                data = json.loads(path.read_text("utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            for activity in data.get("activities", []):
                self._by_id[activity["id"]] = activity


class PlannedWorkoutStore:
    """Planned workouts, one JSON file per year (`<dir>/<year>.json`) plus an
    `index.json` manifest. Keyed by date (one planned workout per day) instead of
    id, and sorted ascending (oldest first) to match sync_workouts.py's existing
    order, the opposite of JsonActivityStore's descending sort. Yearly rather
    than monthly like JsonActivityStore: a year of planned workouts is ~26 KB,
    so there is no churn worth splitting further.

    Unlike the old flat planned_workouts.json (rewritten wholesale from a rolling
    ~7-day-past/90-day-future fetch window every sync), every date ever written
    here survives forever - a sync only re-touches the year(s) whose entries
    actually changed."""

    def __init__(self, dir_path: Path = _PLANNED_DEFAULT_DIR) -> None:
        self._dir = dir_path
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
            try:
                data = json.loads(path.read_text("utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            for entry in data.get("planned", []):
                self._by_date[entry["date"]] = entry
