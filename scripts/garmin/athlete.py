from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from .client import GarminAPIError, GarminClient

_ZONE_PERCENTS = (0.80, 0.89, 0.95, 1.00)
_VO2_PER_KMH = 3.5


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

    lt_speed = user_data.get("lactateThresholdSpeed")
    if lt_speed:
        metrics["thresholdPaceSecPerKm"] = round(1000 / lt_speed)

    vo2max = user_data.get("vo2MaxRunning") or user_data.get("vO2MaxRunning")
    if vo2max:
        metrics["vmaKmh"] = round(vo2max / _VO2_PER_KMH, 1)

    try:
        display_name = client.get_social_profile().get("displayName")
        today = date.today().isoformat()
        summary = client.get_daily_summary(display_name, today) if display_name else {}
    except GarminAPIError:
        summary = {}

    resting_hr = summary.get("restingHeartRate")
    if resting_hr:
        metrics["restingHrBpm"] = int(resting_hr)

    max_hr = summary.get("maxHeartRate")
    if max_hr:
        metrics["maxHrBpm"] = int(max_hr)

    if metrics:
        metrics["lastUpdate"] = datetime.now(timezone.utc).isoformat()

    return metrics
