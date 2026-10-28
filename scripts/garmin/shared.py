"""What both Garmin clients do the same way: page through the activity list,
pull the .fit out of an activity download, read the HR zone config (the same
shape from both APIs). No Connect credential here."""

from __future__ import annotations

import io
import zipfile
from collections.abc import Callable
from typing import Any


def collect_activity_rows(
    get_activities: Callable[..., list[dict[str, Any]]], *, running_only: bool = True
) -> dict[str, dict[str, Any]]:
    """Every activity's list row by id, a page of 100 at a time, from either client."""
    rows: dict[str, dict[str, Any]] = {}
    start = 0
    limit = 100

    while True:
        batch = get_activities(start=start, limit=limit, running_only=running_only)
        if not batch:
            break
        rows.update((str(a["activityId"]), a) for a in batch)
        print(f"  Fetched {len(rows)} activity IDs...", end="\r", flush=True)
        if len(batch) < limit:
            break
        start += limit

    print(f"  Found {len(rows)} total activities on Garmin.       ")
    return rows


def fit_from_archive(content: bytes) -> bytes | None:
    """The .fit inside an activity download, or None for an archive without one
    (an activity imported from a GPX, say). Content that is not an archive at
    all raises zipfile.BadZipFile: a broken transfer, not a missing file."""
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        for name in zf.namelist():
            if name.lower().endswith(".fit"):
                return zf.read(name)
    return None


def running_zone_config(zones: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The running zones, falling back to the all-sport default."""
    by_sport = {zone.get("sport"): zone for zone in zones if isinstance(zone, dict)}
    return by_sport.get("RUNNING") or by_sport.get("DEFAULT")


def zone_floors(zones: list[dict[str, Any]]) -> list[int] | None:
    """The five zone floors in bpm, or None when any is missing."""
    config = running_zone_config(zones) or {}
    floors = [config.get(f"zone{n}Floor") for n in range(1, 6)]
    return [round(floor) for floor in floors] if all(floor is not None for floor in floors) else None
