from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from .client import GarminAPIError, GarminClient

_ZONE_PERCENTS = (0.80, 0.89, 0.95, 1.00)
_VO2_PER_KMH = 3.5


def _age_from_birthdate(birth_date: date) -> int:
    today = date.today()
    had_birthday_this_year = (today.month, today.day) >= (birth_date.month, birth_date.day)
    return today.year - birth_date.year - (0 if had_birthday_this_year else 1)


def fetch_athlete_metrics(client: GarminClient) -> dict[str, Any]:
    metrics: dict[str, Any] = {}

    try:
        user_data = client.get_user_settings().get("userData") or {}
    except GarminAPIError:
        user_data = {}

    lthr = user_data.get("lactateThresholdHeartRate")
    if lthr:
        metrics["lthrBpm"] = round(lthr)
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
        metrics["vmaKmh"] = round(vo2max / _VO2_PER_KMH, 1)

    if metrics:
        metrics["lastUpdate"] = datetime.now(timezone.utc).isoformat()

    return metrics
