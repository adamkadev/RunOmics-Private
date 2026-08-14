from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .client import GarminAPIError, GarminClient

_HISTORY_PATH = Path(__file__).parent.parent.parent / "public" / "data" / "athlete_history.json"

# Threshold and capacity metrics worth a trend line. Garmin exposes only the
# current value of each - there is no history endpoint - so the series is built
# by snapshotting them here, one entry per day the numbers actually move.
_TRACKED_METRICS = ("lthrBpm", "thresholdPaceSecPerKm", "vo2maxMlKgMin", "weightKg")

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


def extract_fitness_age(days: list[dict[str, Any]]) -> dict[str, Any]:
    """Latest fitness age and BMI from Garmin's daily fitness-age series.

    Garmin only recomputes these every few days, so the last entries of a range
    can repeat or carry no values at all - walk backwards to the freshest day
    that actually holds a fitness age.
    """
    for day in reversed(days or []):
        values = day.get("values") or {}
        fitness_age = values.get("fitnessAge")
        if not fitness_age:
            continue

        metrics: dict[str, Any] = {"fitnessAgeYrs": round(fitness_age, 1)}

        achievable = values.get("achievableFitnessAge")
        if achievable:
            metrics["achievableFitnessAgeYrs"] = round(achievable, 1)

        bmi = values.get("bmi")
        if bmi:
            metrics["bmi"] = round(bmi, 1)

        return metrics

    return {}


def _fetch_fitness_age(client: GarminClient) -> dict[str, Any]:
    today = date.today()
    try:
        days = client.get_fitness_age((today - timedelta(days=6)).isoformat(), today.isoformat())
    except GarminAPIError:
        return {}
    return extract_fitness_age(days)


def extract_primary_device(payload: dict[str, Any]) -> dict[str, Any]:
    """Name, firmware and registration date of the watch the metrics come from.

    Garmin returns every device ever registered; only the primary training one
    is the source of the numbers we display, so the rest is dropped. The serial
    number and Garmin's own numeric deviceId are deliberately not kept -
    athlete.json is served publicly and a hardware id buys us nothing.
    """
    registered = payload.get("RegisteredDevices") or []
    if not registered:
        return {}

    primary_id = (payload.get("PrimaryTrainingDevice") or {}).get("deviceId")
    by_id = {device.get("deviceId"): device for device in registered}
    device = by_id.get(primary_id) or next(
        (d for d in registered if d.get("primary")), registered[0]
    )

    info: dict[str, Any] = {}

    name = device.get("displayName") or device.get("productDisplayName")
    if name:
        info["deviceName"] = name

    firmware = device.get("currentFirmwareVersion")
    if firmware:
        info["deviceFirmware"] = str(firmware)

    registered_at = device.get("registeredDate")
    if registered_at:
        info["deviceSince"] = (
            datetime.fromtimestamp(registered_at / 1000, timezone.utc).date().isoformat()
        )

    return info


def _fetch_primary_device(client: GarminClient) -> dict[str, Any]:
    try:
        return extract_primary_device(client.get_primary_training_device())
    except GarminAPIError:
        return {}


def tracked_snapshot(metrics: dict[str, Any]) -> dict[str, Any]:
    return {key: metrics[key] for key in _TRACKED_METRICS if metrics.get(key) is not None}


def record_athlete_history(metrics: dict[str, Any], today: date | None = None) -> bool:
    """Append today's threshold metrics when they differ from the last entry.

    Returns True when a new entry was written. Writing only on change keeps the
    file a change log rather than one identical row per sync, which is what a
    trend line wants: Garmin revises these every few weeks at most.
    """
    snapshot = tracked_snapshot(metrics)
    if not snapshot:
        return False

    days: dict[str, Any] = {}
    if _HISTORY_PATH.exists():
        try:
            days = json.loads(_HISTORY_PATH.read_text()).get("days") or {}
        except Exception:
            days = {}

    latest = days[max(days)] if days else None
    if latest == snapshot:
        return False

    days[(today or date.today()).isoformat()] = snapshot
    _HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    _HISTORY_PATH.write_text(json.dumps({"days": dict(sorted(days.items()))}, indent=2) + "\n")
    return True


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

    metrics.update(_fetch_fitness_age(client))
    metrics.update(_fetch_primary_device(client))

    if metrics:
        metrics["lastUpdate"] = datetime.now(timezone.utc).isoformat()

    return metrics
