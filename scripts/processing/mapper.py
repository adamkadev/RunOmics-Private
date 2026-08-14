from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from processing.activity_type import infer_type
from processing.fit_parser import ActivitySplit, ParsedFit, SplitLap  # noqa: F401
from processing.privacy import crop_privacy_zone

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
    polyline: str | None
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

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "week": self.week,
            "date": self.date,
            "dayOfWeek": self.day_of_week,
            "type": self.type,
            "description": self.description,
            "durationSeconds": self.duration_seconds,
            "distanceKm": self.distance_km,
            "paceSecPerKm": self.pace_sec_per_km,
            "hrZones": [z.to_dict() for z in self.hr_zones],
            "avgHeartRate": self.avg_heart_rate,
            "rpe": self.rpe,
            "comment": self.comment,
            "polyline": self.polyline,
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
            "paceSamples": self.pace_samples,
            "vo2maxGarmin": self.vo2max_garmin,
            "avgTemperature": self.avg_temperature,
            "cadenceSamples": self.cadence_samples,
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


def extract_gear_id(gear_list: list[dict[str, Any]] | None) -> str | None:
    if not gear_list:
        return None
    return gear_list[0].get("uuid")


def map_activity(
    garmin_activity: dict[str, Any],
    parsed: ParsedFit | None,
    *,
    hr_zones: list[HrZone] | None = None,
    file_name: str | None = None,
    gear: list[dict[str, Any]] | None = None,
    weather: dict[str, Any] | None = None,
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
    name: str = garmin_activity.get("activityName", "") or ""
    # Garmin auto-names: "<City> - Morning Run" → "Morning Run"
    if " - " in name:
        name = name.split(" - ", 1)[1]
    # Drop trailing extras: "40 min footing + renforcement" → "40 min footing"
    if " + " in name:
        name = name.split(" + ", 1)[0]
    name = name.strip()

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

    activity_type = infer_type(name, parsed)

    avg_hr_raw = (parsed.avg_heart_rate if parsed else None) or api("averageHR", "avgHr")
    avg_heart_rate: int | None = int(avg_hr_raw) if avg_hr_raw else None

    route = crop_privacy_zone(parsed.route) if parsed and parsed.route else None

    elevation_gain: float | None = None
    if parsed and parsed.elevation_gain_m > 0:
        elevation_gain = parsed.elevation_gain_m
    else:
        raw_elev = api("elevationGain")
        if raw_elev:
            elevation_gain = round(float(raw_elev), 1)

    rpe: int | None = parsed.rpe if parsed else None
    if rpe is None:
        api_rpe = api("directWorkoutRpe", "workoutRpe")
        if api_rpe:
            api_rpe = int(api_rpe)
            rpe = max(1, min(10, round(api_rpe / 10) if api_rpe > 10 else api_rpe))

    hr_samples: list[int] | None = None
    elevation_profile: list[float] | None = None
    pace_samples: list[float] | None = None
    cadence_samples: list[float] | None = None
    if parsed:
        if parsed.heart_rates:
            hr_samples = _decimate_list(parsed.heart_rates, _MAX_CHART_POINTS)
        if parsed.elevation_samples:
            elevation_profile = _decimate_list(parsed.elevation_samples, _MAX_CHART_POINTS)
        if parsed.pace_samples:
            pace_samples = _decimate_list(parsed.pace_samples, _MAX_CHART_POINTS)
        if parsed.cadence_samples:
            cadence_samples = _decimate_list(parsed.cadence_samples, _MAX_CHART_POINTS)

    return ActivityData(
        id=activity_id,
        week=iso_week,
        date=date_str,
        day_of_week=day_of_week,
        type=activity_type,
        description=name,
        duration_seconds=duration_seconds,
        distance_km=distance_km,
        pace_sec_per_km=pace_sec_per_km,
        hr_zones=hr_zones or [],
        avg_heart_rate=avg_heart_rate,
        rpe=rpe,
        comment="",
        polyline=None,
        route=route,
        elevation_gain=elevation_gain,
        aer_training_effect=round(parsed.aer_training_effect, 1) if parsed and parsed.aer_training_effect is not None else None,
        ana_training_effect=round(parsed.ana_training_effect, 1) if parsed and parsed.ana_training_effect is not None else None,
        hr_samples=hr_samples,
        elevation_profile=elevation_profile,
        calories=parsed.calories if parsed else None,
        cadence_spm=parsed.cadence_spm if parsed else None,
        ground_contact_ms=parsed.ground_contact_ms if parsed else None,
        vertical_oscillation_mm=parsed.vertical_oscillation_mm if parsed else None,
        vertical_ratio_pct=parsed.vertical_ratio_pct if parsed else None,
        stride_length_m=parsed.stride_length_m if parsed else None,
        best_efforts=(parsed.best_efforts or None) if parsed else None,
        pace_samples=pace_samples,
        vo2max_garmin=parsed.vo2max_garmin if parsed else None,
        avg_temperature=parsed.avg_temperature if parsed else None,
        cadence_samples=cadence_samples,
        splits=parsed.splits if parsed and parsed.splits else None,
        gear_id=extract_gear_id(gear),
        weather=weather,
    )


def _parse_datetime(raw: str) -> datetime:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(raw, fmt)
        except (ValueError, TypeError):
            pass
    return datetime(1970, 1, 1)


def _decimate_list(items: list, max_points: int) -> list:
    n = len(items)
    if n <= max_points:
        return items
    return [items[round(i * (n - 1) / (max_points - 1))] for i in range(max_points)]
