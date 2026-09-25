#!/usr/bin/env python3
"""Verify that no stored route comes near a configured privacy zone.

This checks the promise, not the implementation: it measures every point of
every stored route against each zone exactly as configured, and fails if any
point lies within the configured radius. It never calls the cropping function
it is checking - an earlier version asked crop_privacy_zone whether its own
output was cropped, a question it could only ever answer yes.

It also reports how far the route endpoints near each zone sit from its
centre. Cropping at one fixed radius put every start and finish on a single
ring around the protected place; a wide spread is what shows they no longer do.
It prints distances only, never coordinates.

Needs PRIVACY_ZONES / PRIVACY_RADIUS_M, like sync.py, and reads the selected
data workspace (RUNOMICS_DATA_DIR). The nightly workflow runs it after the
sync and before anything is pushed, so a failure here publishes nothing.

    python scripts/verify_privacy_zone.py
"""
from __future__ import annotations

import json
import sys
from collections.abc import Iterator
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from data_directory import get_data_dir
from processing.privacy import PrivacyConfigError, configured_zones, distance_m

# Endpoints within this distance of a zone are the ones an observer would use
# to draw its ring, so they are the ones worth reporting.
_NEARBY_M = 2000


def _activities(activities_dir: Path) -> Iterator[dict]:
    index = json.loads((activities_dir / "index.json").read_text("utf-8"))
    for month in index["months"]:
        yield from json.loads((activities_dir / f"{month}.json").read_text("utf-8"))["activities"]


def main(data_dir: Path | None = None) -> int:
    try:
        zones, radius = configured_zones()
    except PrivacyConfigError as exc:
        print(f"Cannot verify: {exc}")
        return 2

    activities_dir = (data_dir or get_data_dir()) / "activities"
    if not (activities_dir / "index.json").exists():
        print(f"No activities in {activities_dir} - nothing to verify.")
        return 0

    checked = 0
    exposed: list[str] = []
    closest = float("inf")
    nearby_endpoints: list[list[float]] = [[] for _ in zones]

    for activity in _activities(activities_dir):
        route = activity.get("route")
        if not route:
            continue
        checked += 1

        nearest = min(distance_m(point, centre) for point in route for centre in zones)
        closest = min(closest, nearest)
        if nearest < radius:
            exposed.append(str(activity.get("id")))

        for i, centre in enumerate(zones):
            for endpoint in (route[0], route[-1]):
                d = distance_m(endpoint, centre)
                if d < _NEARBY_M:
                    nearby_endpoints[i].append(d)

    if exposed:
        print(f"EXPOSED: {len(exposed)} of {checked} routes have a point within {radius:.0f} m of a privacy zone:")
        for activity_id in exposed:
            print(f"  {activity_id}")
        return 1

    print(f"OK - no point of {checked} routes lies within {radius:.0f} m of a privacy zone"
          + (f" (closest: {closest:.0f} m)." if checked else "."))
    for i, distances in enumerate(nearby_endpoints, start=1):
        if distances:
            print(f"  zone {i}: {len(distances)} endpoints within {_NEARBY_M} m, "
                  f"{min(distances):.0f}-{max(distances):.0f} m from its centre")
    return 0


if __name__ == "__main__":
    sys.exit(main())
