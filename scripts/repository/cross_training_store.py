from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path
from typing import Any

from data_directory import get_data_dir
from repository.atomic_write import write_text_atomic
from repository.json_store import _read_entries, dumps_readable


class CrossTrainingStore:
    """Non-running sessions, one file per year (`<dir>/<year>.json`) plus an `index.json` of the years.

    Kept apart from activities/ so that no running metric, load or record can ever read one.
    """

    def __init__(self, dir_path: Path | None = None) -> None:
        self._dir = dir_path or get_data_dir() / "cross_training"
        self._by_id: dict[str, dict[str, Any]] = {}
        self._dirty_years: set[str] = set()
        self._load()

    def ids(self) -> set[str]:
        return set(self._by_id)

    def newest_date(self) -> str | None:
        return max((s["date"] for s in self._by_id.values() if s.get("date")), default=None)

    def all_sessions(self) -> list[dict[str, Any]]:
        return list(self._by_id.values())

    def upsert(self, session: dict[str, Any]) -> None:
        self._by_id[session["id"]] = session
        self._dirty_years.add(session["date"][:4])

    def remove(self, ids: Iterable[str]) -> int:
        removed = 0
        for activity_id in ids:
            session = self._by_id.pop(activity_id, None)
            if session is not None:
                self._dirty_years.add(session["date"][:4])
                removed += 1
        return removed

    def save(self) -> None:
        if not self._dirty_years:
            return
        by_year: dict[str, list[dict[str, Any]]] = {}
        for session in self._by_id.values():
            by_year.setdefault(session["date"][:4], []).append(session)

        for year in self._dirty_years:
            sessions = sorted(by_year.get(year, []), key=lambda s: (s.get("startTimeLocal") or s["date"], s["id"]), reverse=True)
            if sessions:
                write_text_atomic(self._dir / f"{year}.json", dumps_readable({"sessions": sessions}))
            else:
                (self._dir / f"{year}.json").unlink(missing_ok=True)
        self._dirty_years.clear()
        write_text_atomic(self._dir / "index.json", dumps_readable({"years": sorted(by_year, reverse=True)}))

    def _load(self) -> None:
        if not self._dir.exists():
            return
        for path in sorted(self._dir.glob("*.json")):
            if path.name == "index.json":
                continue
            for session in _read_entries(path, "sessions", "id"):
                self._by_id[session["id"]] = session
