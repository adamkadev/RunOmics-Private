from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from processing.activity_type import TypeContext, infer_type_with_source
from processing.fit_parser import ActivitySplit, ParsedFit, SplitLap  # noqa: F401

_MAX_CHART_POINTS = 150


@dataclass
class HrZone:
    zone: int
    seconds: int
    percent: float
    min_bpm: int
    max_bpm: int | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "zone": self.zone,
            "seconds": self.seconds,
            "percent": self.percent,
            "minBpm": self.min_bpm,
            "maxBpm": self.max_bpm,
        }


@dataclass
class ActivityData:
    id: str
    week: int
    date: str
    day_of_week: str
    type: str
    description: str
    duration_seconds: int
    distance_km: float
    pace_sec_per_km: float | None
    hr_zones: list[HrZone]
    avg_heart_rate: int | None
    rpe: int | None
    comment: str
    route: list[list[float]] | None
    elevation_gain: float | None
    aer_training_effect: float | None
    ana_training_effect: float | None
    hr_samples: list[int] | None
    elevation_profile: list[float] | None
    calories: int | None
    cadence_spm: float | None
    ground_contact_ms: float | None
    vertical_oscillation_mm: float | None
    vertical_ratio_pct: float | None
    stride_length_m: float | None
    best_efforts: dict[str, float] | None
    pace_samples: list[float] | None
    vo2max_garmin: float | None
    avg_temperature: int | None
    cadence_samples: list[float] | None
    splits: list[ActivitySplit] | None
    gear_id: str | None
    weather: dict[str, Any] | None = None
    type_source: str = "runomics"
    sport: str | None = None
    start_time_local: str | None = None
    duration_bests: dict[str, float] | None = None
    gap_sec_per_km: float | None = None
    gap_samples: list[int] | None = None
    hr_source: str | None = None
    longest_continuous_run_sec: int | None = None
    longest_continuous_run_m: float | None = None
    running_sec: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "week": self.week,
            "date": self.date,
            "dayOfWeek": self.day_of_week,
            **({"startTimeLocal": self.start_time_local} if self.start_time_local else {}),
            "type": self.type,
            "typeSource": self.type_source,
            **({"sport": self.sport} if self.sport is not None else {}),
            "description": self.description,
            "durationSeconds": self.duration_seconds,
            "distanceKm": self.distance_km,
            "paceSecPerKm": self.pace_sec_per_km,
            "hrZones": [z.to_dict() for z in self.hr_zones],
            "avgHeartRate": self.avg_heart_rate,
            "hrSource": self.hr_source,
            "rpe": self.rpe,
            "comment": self.comment,
            "route": self.route,
            "elevationGain": self.elevation_gain,
            "aerTrainingEffect": self.aer_training_effect,
            "anaTrainingEffect": self.ana_training_effect,
            "hrSamples": self.hr_samples,
            "elevationProfile": self.elevation_profile,
            "calories": self.calories,
            "cadenceSpm": self.cadence_spm,
            "groundContactMs": self.ground_contact_ms,
            "verticalOscillationMm": self.vertical_oscillation_mm,
            "verticalRatioPct": self.vertical_ratio_pct,
            "strideLengthM": self.stride_length_m,
            "bestEfforts": self.best_efforts,
            "durationBests": self.duration_bests,
            "paceSamples": self.pace_samples,
            "gapSecPerKm": self.gap_sec_per_km,
            "gapSamples": self.gap_samples,
            "vo2maxGarmin": self.vo2max_garmin,
            "avgTemperature": self.avg_temperature,
            "cadenceSamples": self.cadence_samples,
            "longestContinuousRunSec": self.longest_continuous_run_sec,
            "longestContinuousRunM": self.longest_continuous_run_m,
            "runningSec": self.running_sec,
            "splits": [s.to_dict() for s in self.splits] if self.splits else None,
            "gearId": self.gear_id,
            "weather": self.weather,
        }


def parse_hr_zones(raw_zones: list[dict[str, Any]]) -> list[HrZone]:
    if not raw_zones:
        return []

    items = sorted(raw_zones, key=lambda z: z.get("zoneNumber", 0))
    total = sum(z.get("secsInZone", 0) for z in items)
    if total == 0:
        return []

    result = []
    for z in items:
        zone_num = int(z.get("zoneNumber", 0))
        secs = int(z.get("secsInZone", 0))
        low = int(z.get("zoneLowBoundary", 0))
        high = z.get("zoneHighBoundary")
        high_bpm = int(high) if high else None
        result.append(HrZone(
            zone=zone_num,
            seconds=secs,
            percent=round(secs / total * 100, 1),
            min_bpm=low,
            max_bpm=high_bpm,
        ))

    return result


def grade_adjusted(parsed: ParsedFit | None, pace_sec_per_km: float | None) -> tuple[float | None, list[int] | None]:
    """The run's grade-adjusted pace, and its stream picked from the same records as paceSamples, in whole seconds."""
    if not parsed or not parsed.gap_factor or not pace_sec_per_km:
        return None, None
    samples = [round(v) for v in _decimate_list(parsed.gap_samples, _MAX_CHART_POINTS)] if parsed.gap_samples else None
    return round(pace_sec_per_km / parsed.gap_factor, 1), samples


def fit_derived_fields(parsed: ParsedFit | None, pace_sec_per_km: float | None) -> dict[str, Any]:
    """The ActivityData fields read from the FIT alone; route and elevation_gain only when the file holds them."""
    if not parsed:
        return dict.fromkeys(_FIT_FIELDS)

    def chart(samples: list) -> list | None:
        return _decimate_list(samples, _MAX_CHART_POINTS) if samples else None

    def te(value: float | None) -> float | None:
        return round(value, 1) if value is not None else None

    gap_sec_per_km, gap_samples = grade_adjusted(parsed, pace_sec_per_km)
    fields: dict[str, Any] = {
        "aer_training_effect": te(parsed.aer_training_effect),
        "ana_training_effect": te(parsed.ana_training_effect),
        "hr_samples": chart(parsed.heart_rates),
        "elevation_profile": chart(parsed.elevation_samples),
        "calories": parsed.calories,
        "cadence_spm": parsed.cadence_spm,
        "ground_contact_ms": parsed.ground_contact_ms,
        "vertical_oscillation_mm": parsed.vertical_oscillation_mm,
        "vertical_ratio_pct": parsed.vertical_ratio_pct,
        "stride_length_m": parsed.stride_length_m,
        "best_efforts": parsed.best_efforts or None,
        "duration_bests": parsed.duration_bests or None,
        "pace_samples": chart(parsed.pace_samples),
        "vo2max_garmin": parsed.vo2max_garmin,
        "avg_temperature": parsed.avg_temperature,
        "cadence_samples": chart(parsed.cadence_samples),
        "splits": parsed.splits or None,
        "gap_sec_per_km": gap_sec_per_km,
        "gap_samples": gap_samples,
        "hr_source": parsed.hr_source,
        "longest_continuous_run_sec": parsed.longest_continuous_run_sec,
        "longest_continuous_run_m": parsed.longest_continuous_run_m,
        "running_sec": parsed.running_sec,
    }
    if parsed.route:
        fields["route"] = parsed.route
    if parsed.elevation_gain_m > 0:
        fields["elevation_gain"] = parsed.elevation_gain_m
    return fields


_FIT_FIELDS = (
    "aer_training_effect", "ana_training_effect", "hr_samples", "elevation_profile", "calories", "cadence_spm",
    "ground_contact_ms", "vertical_oscillation_mm", "vertical_ratio_pct", "stride_length_m", "best_efforts",
    "duration_bests", "pace_samples", "vo2max_garmin", "avg_temperature", "cadence_samples", "splits",
    "gap_sec_per_km", "gap_samples", "hr_source", "longest_continuous_run_sec", "longest_continuous_run_m",
    "running_sec",
)


def stored_fit_fields(parsed: ParsedFit, pace_sec_per_km: float | None) -> dict[str, Any]:
    """fit_derived_fields under the keys and in the JSON form activities are stored with."""
    stored = {
        re.sub(r"_(\w)", lambda m: m.group(1).upper(), key): value
        for key, value in fit_derived_fields(parsed, pace_sec_per_km).items()
    }
    if stored["splits"]:
        stored["splits"] = [split.to_dict() for split in stored["splits"]]
    return stored


def extract_gear_id(gear_list: list[dict[str, Any]] | None) -> str | None:
    if not gear_list:
        return None
    return gear_list[0].get("uuid")


def clean_activity_name(raw: str | None) -> str:
    name = raw or ""
    # Garmin auto-names: "<City> - Morning Run" → "Morning Run"
    if " - " in name:
        name = name.split(" - ", 1)[1]
    # Drop trailing extras: "40 min footing + renforcement" → "40 min footing"
    if " + " in name:
        name = name.split(" + ", 1)[0]
    return name.strip()


def map_activity(
    garmin_activity: dict[str, Any],
    parsed: ParsedFit | None,
    *,
    hr_zones: list[HrZone] | None = None,
    file_name: str | None = None,
    gear: list[dict[str, Any]] | None = None,
    weather: dict[str, Any] | None = None,
    type_context: TypeContext | None = None,
) -> ActivityData:
    summary: dict[str, Any] = garmin_activity.get("summaryDTO") or {}

    def api(*keys: str) -> Any:
        for key in keys:
            value = garmin_activity.get(key)
            if value is None:
                value = summary.get(key)
            if value is not None:
                return value
        return None

    activity_id = str(garmin_activity.get("activityId", ""))
    name = clean_activity_name(garmin_activity.get("activityName"))

    if parsed and parsed.start_time_local:
        dt = parsed.start_time_local
    else:
        dt = _parse_datetime(str(api("startTimeLocal") or ""))
    date_str = dt.strftime("%Y-%m-%d")
    day_of_week = dt.strftime("%A")
    iso_cal = dt.isocalendar()
    iso_week = iso_cal[0] * 100 + iso_cal[1]

    duration_seconds = (parsed.duration_seconds if parsed else 0) or int(
        float(api("duration", "elapsedDuration") or 0)
    )

    distance_m = (parsed.distance_m if parsed else 0.0) or float(api("distance") or 0)
    distance_km = round(distance_m / 1000, 2) if distance_m else 0.0

    pace_sec_per_km: float | None = None
    if distance_km > 0 and duration_seconds > 0:
        pace_sec_per_km = round(duration_seconds / distance_km, 1)

    type_inference = infer_type_with_source(
        name,
        parsed,
        activity_id=activity_id,
        hr_zones=hr_zones or [],
        duration_seconds=duration_seconds,
        date=date_str,
        context=type_context,
    )

    avg_hr_raw = (parsed.avg_heart_rate if parsed else None) or api("averageHR", "avgHr")
    avg_heart_rate: int | None = int(avg_hr_raw) if avg_hr_raw else None

    derived = fit_derived_fields(parsed, pace_sec_per_km)
    route = derived.pop("route", None)
    elevation_gain: float | None = derived.pop("elevation_gain", None)
    if elevation_gain is None:
        raw_elev = api("elevationGain")
        if raw_elev:
            elevation_gain = round(float(raw_elev), 1)

    rpe: int | None = parsed.rpe if parsed else None
    if rpe is None:
        api_rpe = api("directWorkoutRpe", "workoutRpe")
        if api_rpe:
            api_rpe = int(api_rpe)
            rpe = max(1, min(10, round(api_rpe / 10) if api_rpe > 10 else api_rpe))

    return ActivityData(
        sport=(api("activityType", "activityTypeDTO") or {}).get("typeKey"),
        id=activity_id,
        week=iso_week,
        date=date_str,
        day_of_week=day_of_week,
        type=type_inference.activity_type,
        description=name,
        duration_seconds=duration_seconds,
        distance_km=distance_km,
        pace_sec_per_km=pace_sec_per_km,
        hr_zones=hr_zones or [],
        avg_heart_rate=avg_heart_rate,
        rpe=rpe,
        comment="",
        route=route,
        elevation_gain=elevation_gain,
        gear_id=extract_gear_id(gear),
        weather=weather,
        type_source=type_inference.source,
        start_time_local=dt.strftime(_LOCAL_START_FORMAT),
        **derived,
    )


_LOCAL_START_FORMAT = "%Y-%m-%dT%H:%M:%S"


def local_start_time(raw: str | None) -> str | None:
    """A list row's startTimeLocal in the format stored on activities, or None when it does not parse."""
    try:
        return _parse_datetime(str(raw or "")).strftime(_LOCAL_START_FORMAT)
    except ValueError:
        return None


def _parse_datetime(raw: str) -> datetime:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(raw, fmt)
        except (ValueError, TypeError):
            pass
    # No 1970-01-01 fallback, which files a run under a month no view reads: the next run fetches it again.
    raise ValueError(f"unreadable activity start time {raw!r}")


def _decimate_list(items: list, max_points: int) -> list:
    n = len(items)
    if n <= max_points:
        return items
    return [items[round(i * (n - 1) / (max_points - 1))] for i in range(max_points)]
