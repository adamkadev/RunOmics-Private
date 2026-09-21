"""GPS privacy-zone redaction.

Real zone centers and radius are configuration, never code: read from the
PRIVACY_ZONES / PRIVACY_RADIUS_M environment variables (see .env.example),
never hardcoded here. That is what keeps this file safe to publish even
though the app's own repository stays private - a public copy of this
module carries the algorithm, not the two real locations it protects.

Every call site that actually has route data requires this config to be
set and valid - a sync must fail loudly rather than silently persist
uncropped GPS because the config was never set. `crop_privacy_zone(None)` /
`crop_privacy_zone([])` never touch the config, so unrelated tests and
tooling that never pass real route data don't need it either.

Mirrors how GPS platforms (Strava, Garmin Connect) implement a "privacy
zone": only the start and finish are hidden, not the whole route, so the
map/recurring-routes/territory features keep working on real route shape.
"""
from __future__ import annotations

import json
import math
import os

Coord = list[float]  # [lon, lat]


class PrivacyConfigError(RuntimeError):
    """PRIVACY_ZONES / PRIVACY_RADIUS_M is missing or malformed."""


def _load_zones() -> tuple[list[tuple[float, float]], float]:
    raw_zones = os.environ.get("PRIVACY_ZONES")
    raw_radius = os.environ.get("PRIVACY_RADIUS_M")

    if not raw_zones or not raw_radius:
        raise PrivacyConfigError(
            "PRIVACY_ZONES and PRIVACY_RADIUS_M must both be set before syncing real "
            "activity data - without them, GPS routes would be written unredacted. "
            "See .env.example."
        )

    try:
        parsed = json.loads(raw_zones)
        zones = [(float(lon), float(lat)) for lon, lat in parsed]
        radius = float(raw_radius)
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise PrivacyConfigError(f"PRIVACY_ZONES/PRIVACY_RADIUS_M could not be parsed: {exc}") from exc

    if not zones or radius <= 0:
        raise PrivacyConfigError("PRIVACY_ZONES must list at least one [lon, lat] pair, and PRIVACY_RADIUS_M must be positive.")

    return zones, radius


def _haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1 = a
    lon2, lat2 = b
    r = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _in_zone(point: Coord, zones: list[tuple[float, float]], radius: float) -> bool:
    lon, lat = point[0], point[1]
    return any(_haversine_m((lon, lat), zone) < radius for zone in zones)


def crop_privacy_zone(route: list[Coord] | None) -> list[Coord] | None:
    """Strip leading/trailing points within a privacy zone; keep the rest of the route."""
    if not route:
        return route

    zones, radius = _load_zones()

    start = 0
    while start < len(route) and _in_zone(route[start], zones, radius):
        start += 1
    end = len(route)
    while end > start and _in_zone(route[end - 1], zones, radius):
        end -= 1

    cropped = route[start:end]
    return cropped if len(cropped) > 1 else None
