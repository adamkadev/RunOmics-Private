from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any
from collections.abc import Callable

from processing.fit_parser import ParsedFit

_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_HOURLY_VARS = (
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_direction_10m",
    "precipitation",
    "weather_code",
)
_LOCATION_DECIMALS = 1
_FORECAST_MAX_PAST_DAYS = 92
_TIMEOUT_S = 30
_REQUEST_PAUSE_S = 0.5


@dataclass(frozen=True)
class WeatherSnapshot:
    temp_c: float
    apparent_temp_c: float
    humidity_pct: int
    wind_kph: float
    wind_dir_deg: int
    precipitation_mm: float
    code: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "tempC": self.temp_c,
            "apparentTempC": self.apparent_temp_c,
            "humidityPct": self.humidity_pct,
            "windKph": self.wind_kph,
            "windDirDeg": self.wind_dir_deg,
            "precipitationMm": self.precipitation_mm,
            "code": self.code,
        }


def weather_hour(start: datetime, duration_seconds: int) -> str:
    """One bucket per activity: averaging a circular quantity like wind direction across buckets is ambiguous."""
    mid = start + timedelta(seconds=max(duration_seconds, 0) / 2)
    return (mid + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:00")


class WeatherClient:
    """Errors resolve to "no weather": the daily sync must not lose an activity because a weather API blipped."""

    def __init__(
        self,
        *,
        fetch: Callable[[str], dict[str, Any]] | None = None,
        today: date | None = None,
    ) -> None:
        self._fetch = fetch or _get_json
        self._today = today or date.today()
        self._groups: dict[tuple[str, float, float, str], dict[str, WeatherSnapshot]] = {}
        self.requests = 0
        self.failures = 0

    def snapshot(self, lat: float, lon: float, hour: str) -> WeatherSnapshot | None:
        grid_lat = round(lat, _LOCATION_DECIMALS)
        grid_lon = round(lon, _LOCATION_DECIMALS)
        month = hour[:7]

        archive = self._group("archive", grid_lat, grid_lon, month)
        if hour in archive:
            return archive[hour]
        return self._group("forecast", grid_lat, grid_lon, month).get(hour)

    def _group(self, source: str, lat: float, lon: float, month: str) -> dict[str, WeatherSnapshot]:
        key = (source, lat, lon, month)
        if key not in self._groups:
            self._groups[key] = self._load(source, lat, lon, month)
        return self._groups[key]

    def _load(self, source: str, lat: float, lon: float, month: str) -> dict[str, WeatherSnapshot]:
        # Padded by a day on each side: a run late on the last of the month can round into the next one.
        start, end = _month_bounds(month)
        params: dict[str, Any] = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(_HOURLY_VARS),
            "timezone": "auto",
        }

        if source == "archive":
            # The archive rejects a future end_date, and the padding pushes the current month one day past today.
            end = min(end, self._today)
            if start > end:
                return {}
            url = _ARCHIVE_URL
            params["start_date"] = start.isoformat()
            params["end_date"] = end.isoformat()
        else:
            past_days = (self._today - start).days
            if past_days < 0 or past_days > _FORECAST_MAX_PAST_DAYS:
                return {}
            url = _FORECAST_URL
            params["past_days"] = past_days
            params["forecast_days"] = 1

        self.requests += 1
        try:
            payload = self._fetch(f"{url}?{urllib.parse.urlencode(params)}")
        except Exception as exc:
            self.failures += 1
            print(f"  weather: {source} {month} @ {lat},{lon} failed ({type(exc).__name__}: {exc})")
            return {}

        if payload.get("error"):
            self.failures += 1
            print(f"  weather: {source} {month} @ {lat},{lon} rejected ({payload.get('reason')})")
            return {}

        return _parse_hourly(payload)


def weather_for_activity(client: WeatherClient, parsed: ParsedFit) -> dict[str, Any] | None:
    if not parsed.route or parsed.start_time_local is None:
        return None

    lon, lat = parsed.route[0]
    hour = weather_hour(parsed.start_time_local, parsed.duration_seconds)
    snapshot = client.snapshot(lat, lon, hour)
    return snapshot.to_dict() if snapshot else None


def _parse_hourly(payload: dict[str, Any]) -> dict[str, WeatherSnapshot]:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    columns = [hourly.get(name) or [] for name in _HOURLY_VARS]

    result: dict[str, WeatherSnapshot] = {}
    for i, hour in enumerate(times):
        values = [column[i] if i < len(column) else None for column in columns]
        # A partially null hour must stay out: it is what makes the archive fall through to the forecast.
        if any(value is None for value in values):
            continue
        temp, apparent, humidity, wind, wind_dir, precipitation, code = values
        result[hour] = WeatherSnapshot(
            temp_c=round(float(temp), 1),
            apparent_temp_c=round(float(apparent), 1),
            humidity_pct=int(humidity),
            wind_kph=round(float(wind), 1),
            wind_dir_deg=int(wind_dir),
            precipitation_mm=round(float(precipitation), 1),
            code=int(code),
        )
    return result


def _month_bounds(month: str) -> tuple[date, date]:
    year, mon = int(month[:4]), int(month[5:7])
    last_day = monthrange(year, mon)[1]
    return date(year, mon, 1) - timedelta(days=1), date(year, mon, last_day) + timedelta(days=1)


def _get_json(url: str) -> dict[str, Any]:
    time.sleep(_REQUEST_PAUSE_S)
    with urllib.request.urlopen(url, timeout=_TIMEOUT_S) as response:
        return json.loads(response.read().decode("utf-8"))
