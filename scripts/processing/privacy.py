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

Why a zone hides more than a circle
-----------------------------------
Stripping only the points inside a fixed circle leaves every public route
starting and finishing just outside it - on a ring around the very place it
protects. A circle fitted through a handful of endpoints then recovers the
centre to within metres; that is the attack that retired Strava's first
privacy zones. So a zone here hides three things, not one:

- Its centre. Each zone is cropped around a point moved 100-200 m from the
  configured one, in a direction only the configuration determines, and its
  radius grows by that same distance, so the configured circle always stays
  entirely inside what is hidden. A ring fitted to the endpoints finds the
  moved point, not the protected one.
- Its radius. Every activity hides a further 100-300 m of its own, so the
  endpoints of different runs no longer sit on one ring.
- Pass-throughs. A point inside the zone is dropped wherever it falls on the
  route, not only at the start and finish.

Every one of those choices is derived from the configuration (an HMAC keyed on
the PRIVACY_* values, plus PRIVACY_SALT when set), never from a random source.
The same activity always crops the same way, so a re-sync or a reprocess
writes identical routes, and cropping an already-cropped route removes
nothing - the properties migrate_privacy_zone.py and verify_privacy_zone.py
rely on. Nothing new needs storing, and nobody without the configuration can
reproduce the offsets. PRIVACY_SALT is optional but worth setting to a long
random string: without it the key is derived from the coordinates alone, and
someone who both knows this algorithm and can enumerate candidate coordinates
at the exact precision they were typed could test guesses against it.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import math
import os
from dataclasses import dataclass

Coord = list[float]  # [lon, lat]

_EARTH_RADIUS_M = 6371000.0

# How far each zone's centre moves, and how much further every activity hides.
_CENTRE_OFFSET_M = (100.0, 200.0)
_EXTRA_TRIM_M = (100.0, 300.0)


class PrivacyConfigError(RuntimeError):
    """PRIVACY_ZONES / PRIVACY_RADIUS_M is missing or malformed."""


@dataclass(frozen=True)
class _Zone:
    centre: tuple[float, float]  # the moved centre, (lon, lat)
    radius_m: float  # the configured radius plus the distance the centre moved


def _parse_config() -> tuple[list[tuple[float, float]], float]:
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
        configured = [(float(lon), float(lat)) for lon, lat in parsed]
        radius = float(raw_radius)
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise PrivacyConfigError(f"PRIVACY_ZONES/PRIVACY_RADIUS_M could not be parsed: {exc}") from exc

    if not configured or radius <= 0:
        raise PrivacyConfigError("PRIVACY_ZONES must list at least one [lon, lat] pair, and PRIVACY_RADIUS_M must be positive.")

    return configured, radius


def _load_config() -> tuple[list[_Zone], bytes]:
    configured, radius = _parse_config()

    # Keyed on the parsed values rather than the raw strings, so reformatting
    # the secret (spaces, trailing zeros) does not move every zone.
    material = json.dumps({"zones": configured, "radius": radius, "salt": os.environ.get("PRIVACY_SALT") or ""})
    key = hashlib.sha256(material.encode("utf-8")).digest()

    zones = []
    for i, centre in enumerate(configured):
        bearing = 2 * math.pi * _unit(key, f"zone-bearing:{i}")
        moved_by = _between(_CENTRE_OFFSET_M, _unit(key, f"zone-distance:{i}"))
        zones.append(_Zone(centre=_destination(centre, bearing, moved_by), radius_m=radius + moved_by))
    return zones, key


def _unit(key: bytes, label: str) -> float:
    """A number in [0, 1) that only the key can reproduce."""
    digest = hmac.new(key, label.encode("utf-8"), hashlib.sha256).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def _between(bounds: tuple[float, float], unit: float) -> float:
    low, high = bounds
    return low + (high - low) * unit


def _destination(origin: tuple[float, float], bearing_rad: float, distance_m: float) -> tuple[float, float]:
    lon, lat = map(math.radians, origin)
    angular = distance_m / _EARTH_RADIUS_M
    lat2 = math.asin(math.sin(lat) * math.cos(angular) + math.cos(lat) * math.sin(angular) * math.cos(bearing_rad))
    lon2 = lon + math.atan2(
        math.sin(bearing_rad) * math.sin(angular) * math.cos(lat),
        math.cos(angular) - math.sin(lat) * math.sin(lat2),
    )
    return math.degrees(lon2), math.degrees(lat2)


def _haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1 = a
    lon2, lat2 = b
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(h))


def crop_privacy_zone(route: list[Coord] | None, activity_id: str | None = None) -> list[Coord] | None:
    """Drop every point that falls inside a privacy zone, wherever it is on the route.

    `activity_id` picks this activity's extra trim; without one, the largest
    trim applies, so a caller that forgets it hides more, never less.
    """
    if not route:
        return route

    zones, key = _load_config()
    extra = _between(_EXTRA_TRIM_M, _unit(key, f"activity:{activity_id}")) if activity_id else _EXTRA_TRIM_M[1]

    kept = [
        point
        for point in route
        if not any(_haversine_m((point[0], point[1]), zone.centre) < zone.radius_m + extra for zone in zones)
    ]
    return kept if len(kept) > 1 else None


def configured_zones() -> tuple[list[tuple[float, float]], float]:
    """The zones exactly as configured - what the verifier holds the output to."""
    return _parse_config()


def distance_m(point: Coord, centre: tuple[float, float]) -> float:
    return _haversine_m((point[0], point[1]), centre)
