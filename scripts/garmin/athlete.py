from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

from data_directory import get_data_dir
from .client import GarminClient
from .errors import GarminAPIError
from .personal_api import PersonalApiClient
from .shared import running_zone_config
from repository.history_file import read_history_section, write_history

_HISTORY_PATH = get_data_dir() / "athlete_history.json"

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


def _fetch_zone_config(client: GarminClient | PersonalApiClient) -> dict[str, Any] | None:
    """Garmin's heart rate zone config for running, falling back to the all-sport default."""
    try:
        return running_zone_config(client.get_heart_rate_zones())
    except GarminAPIError:
        return None


def zone_metrics(zone_config: dict[str, Any] | None, lthr: float | None) -> dict[str, Any]:
    """Zone floors, max and resting HR from Garmin's zone config; floors from
    LTHR percentages when there is no config to read them from."""
    metrics: dict[str, Any] = {}
    if zone_config:
        floors = [zone_config.get(f"zone{n}Floor") for n in range(1, 6)]
        # `all()` would discard the whole set over a zone 1 floor of 0, which
        # Garmin reports for %maxHR-based profiles, and fall back to zones
        # derived from LTHR percentages. Latent rather than observed: this
        # athlete is on %LTHR, where the fallback happens to agree.
        if all(floor is not None for floor in floors):
            metrics["hrZoneBoundsBpm"] = [round(floor) for floor in floors]

        max_hr = zone_config.get("maxHeartRateUsed")
        if max_hr:
            metrics["maxHrBpm"] = round(max_hr)

        resting_hr = zone_config.get("restingHeartRateUsed")
        if resting_hr:
            metrics["restingHrBpm"] = round(resting_hr)

    if lthr and "hrZoneBoundsBpm" not in metrics:
        metrics["hrZoneBoundsBpm"] = [round(lthr * p) for p in _ZONE_PERCENTS]
    return metrics


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


def extract_current_fitness_age(payload: dict[str, Any]) -> dict[str, Any]:
    """Allowlisted current Fitness Age values and their Garmin freshness dates."""
    if not isinstance(payload, dict):
        return {}
    metrics: dict[str, Any] = {}

    fitness_age = payload.get("fitnessAge")
    if isinstance(fitness_age, (int, float)) and not isinstance(fitness_age, bool):
        metrics["fitnessAgeYrs"] = round(fitness_age, 1)

    achievable = payload.get("achievableFitnessAge")
    if isinstance(achievable, (int, float)) and not isinstance(achievable, bool):
        metrics["achievableFitnessAgeYrs"] = round(achievable, 1)

    components = payload.get("components")
    bmi_component = components.get("bmi") if isinstance(components, dict) else None
    if isinstance(bmi_component, dict):
        bmi = bmi_component.get("value")
        if isinstance(bmi, (int, float)) and not isinstance(bmi, bool):
            metrics["bmi"] = round(bmi, 1)
        if "bmi" in metrics:
            measured_at = _normalized_date(bmi_component.get("lastMeasurementDate"))
            if measured_at:
                metrics["bmiMeasurementDate"] = measured_at

    # Do not persist metadata without a metric for it to describe.
    last_updated = _normalized_datetime(payload.get("lastUpdated"))
    if metrics and last_updated:
        metrics["fitnessAgeLastUpdated"] = last_updated

    return metrics


def _normalized_date(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value[:10]).isoformat()
    except ValueError:
        return None


def _normalized_datetime(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    candidate = value.replace("Z", "+00:00")
    candidate = re.sub(
        r"\.(\d{1,6})(?=(?:[+-]\d{2}:\d{2})?$)",
        lambda match: "." + match.group(1).ljust(6, "0"),
        candidate,
    )
    try:
        return datetime.fromisoformat(candidate).isoformat()
    except ValueError:
        return None


def _fetch_fitness_age(client: GarminClient) -> dict[str, Any]:
    today = date.today()
    try:
        current = extract_current_fitness_age(client.get_current_fitness_age(today.isoformat()))
    except GarminAPIError:
        current = {}
    if current:
        return current

    # The daily endpoint remains a valid fallback. A successful [] is simply
    # an empty result and must not be treated as an error or unsupported data.
    try:
        days = client.get_fitness_age(
            (today - timedelta(days=6)).isoformat(), today.isoformat()
        )
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

    days: dict[str, Any] = read_history_section(_HISTORY_PATH, "days")

    latest = days[max(days)] if days else None
    if latest == snapshot:
        return False

    days[(today or date.today()).isoformat()] = snapshot
    write_history(_HISTORY_PATH, {"days": dict(sorted(days.items()))})
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

    metrics.update(zone_metrics(_fetch_zone_config(client), lthr))

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


def latest_weight_kg(payload: Any) -> float | None:
    """The most recent weigh-in of a weight-service range, in kg (Garmin sends grams)."""
    summaries = payload.get("dailyWeightSummaries") if isinstance(payload, dict) else None
    weighed: list[tuple[str, float]] = []
    for summary in summaries if isinstance(summaries, list) else []:
        if not isinstance(summary, dict):
            continue
        grams = (summary.get("latestWeight") or {}).get("weight")
        day = summary.get("summaryDate")
        if isinstance(day, str) and isinstance(grams, (int, float)) and grams > 0:
            weighed.append((day, grams))
    return round(max(weighed)[1] / 1000, 1) if weighed else None


def fetch_personal_athlete_metrics(client: PersonalApiClient, today: date | None = None) -> dict[str, Any]:
    """What the Personal API knows of the athlete: the zones and the LTHR they
    are built on, fitness age and age, and the latest weigh-in.

    Sex, height, threshold pace, VO2max and the watch come from Connect's user
    settings and device info (fetch_athlete_metrics). Without Connect they keep
    the values last stored - but VO2max, which the sync carries on from the
    runs' FIT readings (vo2max_metrics).
    """
    today = today or date.today()
    zone_config = _fetch_zone_config(client)
    lthr = (zone_config or {}).get("lactateThresholdHeartRateUsed")
    metrics = zone_metrics(zone_config, lthr)
    if lthr:
        metrics["lthrBpm"] = round(lthr)

    try:
        fitness = client.get_current_fitness_age(today.isoformat())
    except GarminAPIError:
        fitness = {}
    metrics.update(extract_current_fitness_age(fitness))
    age = fitness.get("chronologicalAge")
    if isinstance(age, int) and not isinstance(age, bool) and age > 0:
        metrics["age"] = age

    try:
        weight = latest_weight_kg(client.get_weight_range((today - timedelta(days=365)).isoformat(), today.isoformat()))
    except GarminAPIError:
        weight = None
    if weight:
        metrics["weightKg"] = weight

    if metrics:
        metrics["lastUpdate"] = datetime.now(timezone.utc).isoformat()
    return metrics



def vo2max_metrics(vo2max: float) -> dict[str, Any]:
    """VO2max and VMA from a run's FIT reading, in the whole points Connect
    reports. Half up: a reading runs about 0.1 under Connect's precise value,
    so a stored x.5 is likelier Connect's x+1 than its x."""
    whole = float(int(vo2max + 0.5))
    return {"vo2maxMlKgMin": whole, "vmaKmh": round(whole / _VO2_PER_KMH, 1)}
