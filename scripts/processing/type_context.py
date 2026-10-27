from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from processing.activity_type import PlannedRep, PlannedSession, TypeContext
from processing.planned_workout_type import type_from_coaching_type

# Daniels puts threshold near 88% of vVO2max in trained runners; a beginner's sits lower.
_THRESHOLD_SHARE_OF_VMA = 0.85
_REP_KINDS = ("effort", "strides")


def load_type_context(data_dir: Path) -> TypeContext:
    athlete = _read(data_dir / "athlete.json") or {}
    lthr = athlete.get("lthrBpm")
    bounds = athlete.get("hrZoneBoundsBpm") or []
    return TypeContext(
        threshold_speed_ms=_threshold_speed(athlete),
        lthr_bpm=lthr,
        z4_floor_bpm=bounds[3] if lthr and len(bounds) > 3 else None,
        sessions_by_date=_sessions_by_date(_plans(data_dir / "coaching")),
        hr_reliable_from=_iso_date(athlete.get("hrReliableFrom")),
        hr_unreliable_ids=_hr_unreliable_ids(_read(data_dir / "activity_notes.json") or {}),
    )


def _iso_date(value: Any) -> str | None:
    return value if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) else None


def _hr_unreliable_ids(backup: dict[str, Any]) -> frozenset[str]:
    """From the nightly copy of the run notes, where the owner marks a run's heart rate unreliable."""
    notes = backup.get("notes")
    if not isinstance(notes, dict):
        return frozenset()
    return frozenset(
        activity_id for activity_id, note in notes.items() if isinstance(note, dict) and note.get("hrUnreliable") is True
    )


def _threshold_speed(athlete: dict[str, Any]) -> float | None:
    pace = athlete.get("thresholdPaceSecPerKm")
    if pace:
        return 1000 / pace
    vma = athlete.get("vmaKmh")
    return vma / 3.6 * _THRESHOLD_SHARE_OF_VMA if vma else None


def _plans(coaching_dir: Path) -> list[dict[str, Any]]:
    archived = [plan for path in sorted((coaching_dir / "superseded").glob("*.json")) if (plan := _read(path))]
    archived.sort(key=lambda plan: (plan.get("provenance") or {}).get("createdAt", ""), reverse=True)
    current = _read(coaching_dir / "current_plan.json")
    return [current, *archived] if current else archived


def _sessions_by_date(plans: list[dict[str, Any]]) -> dict[str, tuple[PlannedSession, ...]]:
    """As the app's sessionsAcrossPlans: a day a newer plan's week covers belongs to that plan alone."""
    sessions: dict[str, list[PlannedSession]] = {}
    covered: list[tuple[str, str]] = []
    for plan in plans:
        weeks = plan.get("weeks") or []
        for week in weeks:
            for workout in week.get("workouts") or []:
                date = str(workout.get("date", ""))[:10]
                activity_type = type_from_coaching_type(workout.get("type"))
                if not activity_type or workout.get("status") == "cancelled":
                    continue
                if any(start <= date <= end for start, end in covered):
                    continue
                sessions.setdefault(date, []).append(PlannedSession(activity_type, _planned_reps(workout)))
        covered.extend((week.get("startDate", ""), week.get("endDate", "")) for week in weeks)
    return {date: tuple(day) for date, day in sessions.items()}


def _planned_reps(workout: dict[str, Any]) -> tuple[PlannedRep, ...]:
    reps: list[PlannedRep] = []
    for block in workout.get("blocks") or []:
        if block.get("kind") in _REP_KINDS:
            reps.append(_rep(block))
        elif block.get("kind") == "repeat":
            steps = [_rep(step) for step in block.get("steps") or [] if step.get("kind") in _REP_KINDS]
            reps.extend(steps * int(block.get("repetitions") or 1))
    return tuple(reps)


def _rep(step: dict[str, Any]) -> PlannedRep:
    target = step.get("target") or {}
    return PlannedRep(seconds=target.get("durationSeconds"), meters=target.get("distanceMeters"))


def _read(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        # The type is only a better guess with it, so a bad file costs the plan's hint, never the sync.
        print(f"  Warning: {path} could not be read ({type(exc).__name__}: {exc}); typing runs without it.")
        return None
    return data if isinstance(data, dict) else None
