from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from .client import GarminAPIError, GarminClient

# Fallback zone floors as a fraction of LTHR, used only when Garmin's own
# zone config is unavailable.
_ZONE_PERCENTS = (0.65, 0.80, 0.89, 0.95, 1.00)
_VO2_PER_KMH = 3.5


def _age_from_birthdate(birth_date: date) -> int:
    today = date.today()
    had_birthday_this_year = (today.month, today.day) >= (birth_date.month, birth_date.day)
    return today.year - birth_date.year - (0 if had_birthday_this_year else 1)


def _fetch_zone_config(client: GarminClient) -> dict[str, Any] | None:
    """Garmin's heart rate zone config for running, falling back to the all-sport default."""
    try:
        zones = client.get_heart_rate_zones()
    except GarminAPIError:
        return None

    by_sport = {zone.get("sport"): zone for zone in zones}
    return by_sport.get("RUNNING") or by_sport.get("DEFAULT")


def fetch_athlete_metrics(client: GarminClient) -> dict[str, Any]:
    metrics: dict[str, Any] = {}

    try:
        user_data = client.get_user_settings().get("userData") or {}
    except GarminAPIError:
        user_data = {}

    lthr = user_data.get("lactateThresholdHeartRate")
    if lthr:
        metrics["lthrBpm"] = round(lthr)

    zone_config = _fetch_zone_config(client)
    if zone_config:
        floors = [zone_config.get(f"zone{n}Floor") for n in range(1, 6)]
        if all(floors):
            metrics["hrZoneBoundsBpm"] = [round(floor) for floor in floors]

        max_hr = zone_config.get("maxHeartRateUsed")
        if max_hr:
            metrics["maxHrBpm"] = round(max_hr)

        resting_hr = zone_config.get("restingHeartRateUsed")
        if resting_hr:
            metrics["restingHrBpm"] = round(resting_hr)

    if lthr and "hrZoneBoundsBpm" not in metrics:
        metrics["hrZoneBoundsBpm"] = [round(lthr * p) for p in _ZONE_PERCENTS]

    birth_date = user_data.get("birthDate")
    if birth_date:
        metrics["age"] = _age_from_birthdate(date.fromisoformat(birth_date))

    gender = user_data.get("gender")
    if gender:
        metrics["sex"] = "male" if gender == "MALE" else "female"

    lt_speed = user_data.get("lactateThresholdSpeed")
    if lt_speed:
        metrics["thresholdPaceSecPerKm"] = round(100 / lt_speed)

    vo2max = user_data.get("vo2MaxRunning") or user_data.get("vO2MaxRunning")
    if vo2max:
        metrics["vo2maxMlKgMin"] = round(vo2max, 1)
        metrics["vmaKmh"] = round(vo2max / _VO2_PER_KMH, 1)

    weight_g = user_data.get("weight")
    if weight_g:
        metrics["weightKg"] = round(weight_g / 1000, 1)

    height = user_data.get("height")
    if height:
        metrics["heightCm"] = round(height, 1)

    if metrics:
        metrics["lastUpdate"] = datetime.now(timezone.utc).isoformat()

    return metrics
