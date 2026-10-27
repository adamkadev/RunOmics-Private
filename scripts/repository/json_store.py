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


def _zone_seconds(zones: Any) -> list[Any] | None:
    return [zone.get("seconds") for zone in zones if isinstance(zone, dict)] if isinstance(zones, list) else None


def _month_of(date: str) -> str | None:
    return date[:7] if len(date) >= 7 else None


def _read_entries(path: Path, key: str, id_field: str) -> list[dict[str, Any]]:
    """The entries of one month or year file, or HistoryFileError.

    Both stores rewrite every dirty file, and index.json, from memory on
    save(). A file skipped here would come back holding only this sync's
    entries - or leave the index altogether if none landed in it - so an
    unreadable file stops the store instead, as the history files do.
    """
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


def _is_leaf(value: Any) -> bool:
    """A scalar, or a list of scalars such as a [lon, lat] pair."""
    if isinstance(value, dict):
        return False
    if isinstance(value, list):
        return all(not isinstance(item, (dict, list)) for item in value)
    return True


def dumps_readable(value: Any, indent: str = "") -> str:
    """Objects one key a line so a diff names the field; number arrays and pairs on one line, 2.5x smaller than indent=2."""
    if isinstance(value, dict):
        if not value:
            return "{}"
        inner = indent + "  "
        fields = [f"{inner}{json.dumps(key, ensure_ascii=False)}: {dumps_readable(item, inner)}" for key, item in value.items()]
        return "{\n" + ",\n".join(fields) + "\n" + indent + "}"
    if isinstance(value, list) and value and not all(_is_leaf(item) for item in value):
        inner = indent + "  "
        return "[\n" + ",\n".join(inner + dumps_readable(item, inner) for item in value) + "\n" + indent + "]"
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _atomic_write_json(path: Path, data: dict[str, Any]) -> None:
    # No trailing newline: the bytes these files have always had.
    write_text_atomic(path, dumps_readable(data))


class JsonActivityStore:
    """Activities are stored one JSON file per month (`<dir>/<YYYY-MM>.json`) plus
    an `index.json` manifest of available months, so a sync only rewrites the
    file(s) for the month(s) it actually touched.

    Monthly rather than yearly: activities carry downsampled sample arrays, so a
    year file reaches ~7 MB by December and every sync rewrote it wholesale. A
    month is ~600 KB and closed months never move again."""

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

    def get_gear_pending_ids(self) -> list[str]:
        return [aid for aid, a in self._by_id.items() if a.get("gearPending")]

    def all_activities(self) -> list[dict[str, Any]]:
        return list(self._by_id.values())

    def touch(self, activity_id: str) -> None:
        month = _month_of(self._by_id[activity_id].get("date", ""))
        if month:
            self._dirty_months.add(month)

    def update(self, activity_id: str, fields: dict[str, Any]) -> bool:
        activity = self._by_id.get(activity_id)
        if activity is None or all(activity.get(key) == value for key, value in fields.items()):
            return False
        activity.update(fields)
        self.touch(activity_id)
        return True

    def remove(self, activity_id: str) -> dict[str, Any] | None:
        if activity_id not in self._by_id:
            return None
        self.touch(activity_id)
        return self._by_id.pop(activity_id)

    def update_gear(self, activity_id: str, gear_id: str | None) -> bool:
        activity = self._by_id.get(activity_id)
        if activity is None:
            return False
        answered = activity.pop("gearPending", None) is not None
        changed = activity.get("gearId") != gear_id
        activity["gearId"] = gear_id
        if changed or answered:
            self.touch(activity_id)
        return changed

    def set_start_time(self, activity_id: str, start: str) -> bool:
        activity = self._by_id.get(activity_id)
        if activity is None or activity.get("startTimeLocal") == start:
            return False
        activity["startTimeLocal"] = start
        self.touch(activity_id)
        return True

    def upsert(
        self,
        activity: ActivityData,
        *,
        replace: bool = False,
        keep_gear: bool = False,
        gear_pending: bool = False,
        keep_zone_bounds: bool = False,
    ) -> bool:
        """Store one activity; True when it is new.

        keep_gear: nothing asked for the gear (only Connect's private API
        knows it), so the shoe on file stays.
        keep_zone_bounds: the zones' bpm are the athlete's current ones (the
        Personal API's), not those the activity was recorded with; where the
        time in each zone is the same, the stored zones stay.
        """
        new_dict = activity.to_dict()
        existing = self._by_id.get(activity.id)
        if existing is not None:
            # Typed into the data repository, and never sent back by Garmin:
            # no re-fetch may drop them, a forced one (replace) included.
            new_dict["comment"] = existing.get("comment", "")
            if existing.get("rpe") is not None:
                new_dict["rpe"] = existing["rpe"]
            if keep_gear:
                new_dict["gearId"] = existing.get("gearId")
                gear_pending = bool(existing.get("gearPending"))
            if keep_zone_bounds and _zone_seconds(existing.get("hrZones")) == _zone_seconds(new_dict.get("hrZones")):
                new_dict["hrZones"] = existing.get("hrZones")
            # Weather can be re-derived (backfill_weather.py), so replace
            # starts it over with everything else Garmin sends.
            if not replace and new_dict.get("weather") is None:
                new_dict["weather"] = existing.get("weather")
        if keep_gear and gear_pending:
            new_dict["gearPending"] = True

        if existing is not None:
            self.touch(activity.id)
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
            if month not in by_month:
                (self._dir / f"{month}.json").unlink(missing_ok=True)
                continue
            activities = sorted(by_month[month], key=lambda a: a.get("date", ""), reverse=True)
            _atomic_write_json(self._dir / f"{month}.json", {"activities": activities})
        self._dirty_months.clear()

        _atomic_write_json(self._dir / "index.json", {"months": sorted(by_month.keys(), reverse=True)})

    def count(self) -> int:
        return len(self._by_id)

    def _load(self) -> None:
        if not self._dir.exists():
            return
        found_in: dict[str, Path] = {}
        for path in sorted(self._dir.glob("*.json")):
            if path.name == "index.json":
                continue
            for activity in _read_entries(path, "activities", "id"):
                first = found_in.setdefault(activity["id"], path)
                if first != path:
                    # One of the two copies would win silently and the other month keep counting the run.
                    raise HistoryFileError(
                        f"Activity {activity['id']} is in both {first.name} and {path.name}. Refusing to continue: "
                        f"delete the stale copy in the data repository, then re-run."
                    )
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
