from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from math import ceil
from statistics import median
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from processing.fit_parser import ParsedFit


_PRIMARY_BENEFIT_TYPES: dict[int, str] = {
    1: "Base",
    2: "Base",
    3: "Tempo",
    4: "Threshold",
    5: "VO2Max",
    6: "Anaerobic",
    7: "Sprint",
}

# A watch lap button pressed twice records an "active" split of a few seconds; no rep is that short.
_LAP_NOISE_SECONDS = 15
# A rep this close to threshold speed is quality work; a walk/run jog rep sits far below it.
_INTENSE_SHARE_OF_THRESHOLD_SPEED = 0.9
_PLAN_REP_TOLERANCE = 0.25


@dataclass(frozen=True)
class TypeInference:
    activity_type: str
    source: str


@dataclass(frozen=True)
class PlannedRep:
    seconds: float | None = None
    meters: float | None = None


@dataclass(frozen=True)
class PlannedSession:
    activity_type: str
    reps: tuple[PlannedRep, ...] = ()


@dataclass(frozen=True)
class TypeContext:
    threshold_speed_ms: float | None = None
    lthr_bpm: int | None = None
    z4_floor_bpm: int | None = None
    sessions_by_date: Mapping[str, tuple[PlannedSession, ...]] = field(default_factory=dict)
    hr_reliable_from: str | None = None
    hr_unreliable_ids: frozenset[str] = frozenset()

    def hr_trusted(self, activity_id: str | None, date: str | None, hr_source: str | None) -> bool:
        """As the app's isHrTrusted: once a reliable sensor is in use, a run on the wrist sensor alone is not trusted."""
        if activity_id and activity_id in self.hr_unreliable_ids:
            return False
        if not self.hr_reliable_from:
            return True
        return (date or "")[:10] >= self.hr_reliable_from and hr_source != "wrist"


@dataclass(frozen=True)
class _Rep:
    seconds: int
    meters: float
    speed_ms: float
    hr: int | None


def infer_type_with_source(
    name: str,
    parsed: ParsedFit | None,
    *,
    activity_id: str | None = None,
    hr_zones: Sequence[Any] = (),
    duration_seconds: int | None = None,
    date: str | None = None,
    context: TypeContext | None = None,
) -> TypeInference:
    del name  # Names are intentionally not used as device/profile-specific hints.

    if parsed and parsed.is_race:
        return TypeInference("Race", "garmin")

    if parsed and parsed.primary_benefit in _PRIMARY_BENEFIT_TYPES:
        return TypeInference(_PRIMARY_BENEFIT_TYPES[parsed.primary_benefit], "garmin")

    context = context or TypeContext()
    trusted = context.hr_trusted(activity_id, date, parsed.hr_source if parsed else None)
    inferred = _infer_runomics_type(
        parsed,
        hr_zones=hr_zones if trusted else (),
        hr_trusted=trusted,
        duration_seconds=duration_seconds,
        date=date,
        context=context,
    )
    return TypeInference(inferred, "runomics")


def infer_type(
    name: str,
    parsed: ParsedFit | None,
    *,
    hr_zones: Sequence[Any] = (),
    duration_seconds: int | None = None,
    date: str | None = None,
    context: TypeContext | None = None,
) -> str:
    return infer_type_with_source(
        name,
        parsed,
        hr_zones=hr_zones,
        duration_seconds=duration_seconds,
        date=date,
        context=context,
    ).activity_type


def _infer_runomics_type(
    parsed: ParsedFit | None,
    *,
    hr_zones: Sequence[Any],
    hr_trusted: bool,
    duration_seconds: int | None,
    date: str | None,
    context: TypeContext,
) -> str:
    reps, recovery_seconds = _interval_evidence(parsed)

    for session in context.sessions_by_date.get((date or "")[:10], ()):
        if _matches_session(reps, session):
            return session.activity_type

    if reps and _is_intense(reps, context, hr_trusted=hr_trusted):
        typical_effort = median(rep.seconds for rep in reps)
        active_seconds = sum(rep.seconds for rep in reps)
        recovery_ratio = recovery_seconds / active_seconds if active_seconds else 0.0
        repetitions = len(reps)

        if repetitions >= 4 and typical_effort <= 45 and recovery_ratio >= 0.6:
            return "Sprint"
        if repetitions >= 3 and typical_effort <= 120 and recovery_ratio >= 0.4:
            return "Anaerobic"
        if repetitions >= 3 and 120 < typical_effort <= 360 and recovery_ratio >= 0.2:
            return "VO2Max"
        if repetitions >= 2 and 360 < typical_effort <= 1_200:
            return "Threshold"

    duration = duration_seconds or (parsed.duration_seconds if parsed else 0)
    # Zones off a guessed max HR file a beginner's easy jog as Z4: time in zone means nothing without an anchor.
    anchored = context.lthr_bpm is not None or (parsed is not None and parsed.aer_training_effect is not None)
    if anchored and duration >= 20 * 60:
        z3 = _zone_share(hr_zones, 3)
        z4 = _zone_share(hr_zones, 4)
        z5 = _zone_share(hr_zones, 5)
        high = z4 + z5

        if z5 >= 20:
            return "VO2Max"
        if z4 >= 20 and high >= 35:
            return "Threshold"
        if z3 >= 35 and high < 30:
            return "Tempo"

    # Missing or ambiguous evidence stays Base: this never fabricates a Training Effect.
    return "Base"


def _interval_evidence(parsed: ParsedFit | None) -> tuple[list[_Rep], int]:
    if not parsed or not parsed.splits:
        return [], 0

    reps: list[_Rep] = []
    recovery = 0
    for split in parsed.splits:
        if split.type == "interval_active":
            laps = [lap for lap in split.laps if lap.duration_sec > 0]
            parts = laps if len(laps) >= 2 else [split] if split.duration_sec > 0 else []
            reps.extend(
                _Rep(part.duration_sec, part.distance_m, part.avg_speed_ms, part.avg_hr)
                for part in parts
                if part.duration_sec >= _LAP_NOISE_SECONDS
            )
        elif split.type in ("interval_rest", "interval_recovery"):
            recovery += max(0, split.duration_sec)
    return reps, recovery


def _matches_session(reps: list[_Rep], session: PlannedSession) -> bool:
    planned = session.reps
    if len(planned) <= 1 and len(reps) <= 1:
        return True
    if not planned or not ceil(len(planned) / 2) <= len(reps) <= len(planned) + 1:
        return False
    if all(rep.seconds for rep in planned):
        return _close(median(rep.seconds for rep in reps), median(rep.seconds for rep in planned))
    if all(rep.meters for rep in planned):
        return _close(median(rep.meters for rep in reps), median(rep.meters for rep in planned))
    return True


def _close(actual: float, planned: float) -> bool:
    return abs(actual - planned) <= _PLAN_REP_TOLERANCE * planned


def _is_intense(reps: list[_Rep], context: TypeContext, *, hr_trusted: bool) -> bool:
    # A profile with no threshold reference keeps the structure-only reading it always had.
    if context.threshold_speed_ms is None and context.lthr_bpm is None:
        return True
    speeds = [rep.speed_ms for rep in reps if rep.speed_ms > 0]
    if context.threshold_speed_ms and speeds:
        if median(speeds) >= _INTENSE_SHARE_OF_THRESHOLD_SPEED * context.threshold_speed_ms:
            return True
    heart_rates = [rep.hr for rep in reps if rep.hr and hr_trusted]
    return bool(context.lthr_bpm and context.z4_floor_bpm and heart_rates and median(heart_rates) >= context.z4_floor_bpm)


def _zone_share(hr_zones: Sequence[Any], zone_number: int) -> float:
    for zone in hr_zones:
        if isinstance(zone, dict):
            number = zone.get("zone")
            percent = zone.get("percent")
        else:
            number = getattr(zone, "zone", None)
            percent = getattr(zone, "percent", None)
        if number == zone_number and isinstance(percent, (int, float)):
            return max(0.0, float(percent))
    return 0.0
