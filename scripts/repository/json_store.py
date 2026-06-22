from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from processing.mapper import ActivityData

_DEFAULT_DIR = Path(__file__).resolve().parents[2] / "public" / "data" / "activities"


def _year_of(date: str) -> str | None:
    return date[:4] if len(date) >= 4 else None


class JsonActivityStore:
    """Activities are stored one JSON file per year (`<dir>/<year>.json`) plus an
    `index.json` manifest of available years, so a sync only rewrites the file(s)
    for the year(s) it actually touched instead of one ever-growing file."""

    def __init__(self, dir_path: Path = _DEFAULT_DIR) -> None:
        self._dir = dir_path
        self._by_id: dict[str, dict[str, Any]] = {}
        self._dirty_years: set[str] = set()
        self._load()

    def get_existing_ids(self) -> set[str]:
        return set(self._by_id.keys())

    def get_ids_since(self, days: int) -> list[str]:
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        return [aid for aid, a in self._by_id.items() if a.get("date", "") >= cutoff]

    def all_activities(self) -> list[dict[str, Any]]:
        return list(self._by_id.values())

    def touch(self, activity_id: str) -> None:
        year = _year_of(self._by_id[activity_id].get("date", ""))
        if year:
            self._dirty_years.add(year)

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

        self._by_id[activity.id] = new_dict
        self.touch(activity.id)
        return existing is None

    def save(self) -> None:
        if not self._dirty_years:
            return

        by_year: dict[str, list[dict[str, Any]]] = {}
        for activity in self._by_id.values():
            year = _year_of(activity.get("date", ""))
            if year:
                by_year.setdefault(year, []).append(activity)

        self._dir.mkdir(parents=True, exist_ok=True)
        for year in self._dirty_years:
            activities = sorted(by_year.get(year, []), key=lambda a: a.get("date", ""), reverse=True)
            self._write_json(self._dir / f"{year}.json", {"activities": activities})
        self._dirty_years.clear()

        self._write_json(self._dir / "index.json", {"years": sorted(by_year.keys(), reverse=True)})

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

    @staticmethod
    def _write_json(path: Path, data: dict[str, Any]) -> None:
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        tmp.replace(path)
