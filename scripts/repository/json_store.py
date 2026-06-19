from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from processing.mapper import ActivityData

_DEFAULT_PATH = Path(__file__).resolve().parents[2] / "public" / "data" / "activities.json"


class JsonActivityStore:
    def __init__(self, path: Path = _DEFAULT_PATH) -> None:
        self._path = path
        self._data: dict[str, Any] = self._load()

    def get_existing_ids(self) -> set[str]:
        return {a["id"] for a in self._data.get("activities", [])}

    def get_ids_since(self, days: int) -> list[str]:
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        return [
            a["id"] for a in self._data.get("activities", [])
            if a.get("date", "") >= cutoff
        ]

    def update_gear(self, activity_id: str, gear_id: str | None) -> bool:
        for a in self._data.get("activities", []):
            if a["id"] == activity_id:
                if a.get("gearId") == gear_id:
                    return False
                a["gearId"] = gear_id
                return True
        return False

    def upsert(self, activity: ActivityData, *, replace: bool = False) -> bool:
        activities: list[dict[str, Any]] = self._data.setdefault("activities", [])
        new_dict = activity.to_dict()

        for i, existing in enumerate(activities):
            if existing["id"] == activity.id:
                if not replace:
                    new_dict["rpe"] = existing.get("rpe", new_dict["rpe"])
                    new_dict["comment"] = existing.get("comment", "")
                activities[i] = new_dict
                return False

        activities.append(new_dict)
        return True

    def save(self) -> None:
        activities: list[dict[str, Any]] = self._data.get("activities", [])
        activities.sort(key=lambda a: a.get("date", ""), reverse=True)
        self._data["activities"] = activities

        tmp = self._path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(self._data, indent=2, ensure_ascii=False))
        tmp.replace(self._path)

    def count(self) -> int:
        return len(self._data.get("activities", []))

    def _load(self) -> dict[str, Any]:
        if not self._path.exists():
            return {"activities": []}
        try:
            return json.loads(self._path.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            return {"activities": []}
