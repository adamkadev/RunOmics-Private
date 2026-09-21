#!/usr/bin/env python3
"""Sync upcoming Garmin race events into the private data workspace.

Uses Garmin's dedicated upcoming-events endpoint so RunOmics can retain richer
race metadata such as:

- custom time goals
- primary-event designation
- training-event designation

Garmin is the source of truth when it supplies these fields. Existing locally
persisted values are used only as a fallback when Garmin stays silent - and
silence means the event carried no eventCustomization at all. Once Garmin sends
one, it is answering about the goal, so clearing a time goal in Garmin Connect
clears it here. The cost of that, deliberately accepted: a targetSeconds set by
hand in the data file no longer survives a sync of an event Garmin customizes.

Can be run standalone or imported by sync.py.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from garmin.client import GarminAPIError, GarminAuthError, GarminClient
from data_directory import get_data_dir

_FUTURE_DAYS = 365
_EVENT_LIMIT = 100
_RETRY_PAUSE = 60.0

_UNIT_TO_KM = {"kilometer": 1.0, "meter": 0.001, "mile": 1.60934}
_STANDARD_DISTANCES_KM = [
    (1.0, "1K"),
    (5.0, "5K"),
    (10.0, "10K"),
    (21.0975, "Half-Marathon"),
    (42.195, "Marathon"),
]
_STANDARD_DISTANCE_TOLERANCE = 0.03


def main() -> int:
    args = _parse_args()

    secret = os.environ.get("GARMIN_SECRET", "").strip()
    if not secret:
        print(
            "Error: GARMIN_SECRET environment variable is not set.",
            file=sys.stderr,
        )
        print(
            "Run scripts/get_secret.py to generate it.",
            file=sys.stderr,
        )
        return 1

    try:
        with GarminClient(secret) as client:
            races = fetch_upcoming_races(client)
    except GarminAuthError as exc:
        print(f"Auth error: {exc}", file=sys.stderr)
        return 1
    except GarminAPIError as exc:
        print(f"Garmin API error: {exc}", file=sys.stderr)
        return 1

    if args.dry_run:
        _print_races(races, prefix="Dry run")
        return 0

    write_upcoming_races(races)
    return 0


def fetch_upcoming_races(client: GarminClient) -> list[dict]:
    """Fetch upcoming Garmin races for the configured future horizon."""

    print(f"Syncing upcoming races for the next {_FUTURE_DAYS} days…")

    events = _retry_on_429(
        lambda: client.get_upcoming_events(
            num_days_forward=_FUTURE_DAYS,
            limit=_EVENT_LIMIT,
        )
    )

    seen: set[tuple[str, str]] = set()
    races: list[dict] = []

    # Process richer identities first so duplicate payloads cannot cause an
    # id-only representation to hide an available shareable UUID.
    ordered_events = sorted(events, key=_event_identity_rank)

    for item in ordered_events:
        if not item.get("race"):
            continue

        identity_keys = _event_identity_keys(item)
        if not identity_keys or any(key in seen for key in identity_keys):
            continue

        event_date = item.get("date")
        if not event_date:
            continue

        seen.update(identity_keys)
        races.append(_map_race(item))

    races.sort(key=lambda race: race["date"])

    print(f"  Found {len(races)} race(s).")
    return races


def write_upcoming_races(
    races: list[dict],
    *,
    data_dir: Path | None = None,
) -> None:
    """Persist races while retaining local values only when Garmin omits them."""

    selected_data_dir = data_dir or get_data_dir()
    selected_data_dir.mkdir(parents=True, exist_ok=True)

    out_path = selected_data_dir / "upcoming_races.json"

    existing: dict[tuple[str, str], dict] = {}

    if out_path.exists():
        try:
            raw = json.loads(out_path.read_text())

            for entry in raw.get("races", []):
                for key in _event_identity_keys(
                    entry,
                    include_fallback=True,
                ):
                    existing.setdefault(key, entry)

        except (json.JSONDecodeError, OSError):
            pass

    for entry in races:
        prior = next(
            (
                existing[key]
                for key in _event_identity_keys(
                    entry,
                    include_fallback=True,
                )
                if key in existing
            ),
            None,
        )

        if not prior:
            continue

        # Garmin wins when it provides a goal.
        # Preserve the previous value only if Garmin omitted it.
        if (
            "targetSeconds" not in entry
            and prior.get("targetSeconds") is not None
        ):
            entry["targetSeconds"] = prior["targetSeconds"]

        # Same fallback principle for optional customization metadata.
        if (
            "isPrimaryEvent" not in entry
            and prior.get("isPrimaryEvent") is not None
        ):
            entry["isPrimaryEvent"] = prior["isPrimaryEvent"]

        if (
            "isTrainingEvent" not in entry
            and prior.get("isTrainingEvent") is not None
        ):
            entry["isTrainingEvent"] = prior["isTrainingEvent"]

    for entry in races:
        # The tombstone has done its job above; the file keeps its shape.
        if entry.get("targetSeconds", False) is None:
            del entry["targetSeconds"]

    races.sort(key=lambda race: race["date"])

    out_path.write_text(
        json.dumps(
            {"races": races},
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )

    print(f"  {len(races)} race(s) written to upcoming_races.json")


def _map_race(item: dict) -> dict:
    distance = _format_distance(item.get("completionTarget"))

    customization = item.get("eventCustomization") or {}

    entry: dict = {
        "date": item["date"],
        "name": _strip_distance_suffix(
            (item.get("eventName") or "").strip(),
            distance,
        ),
        "distance": distance,
    }

    event_uuid = _event_uuid(item)
    if event_uuid is not None:
        entry["garminEventUuid"] = event_uuid

    event_id = _numeric_event_id(item)
    if event_id is not None:
        entry["garminEventId"] = event_id

    if item.get("location"):
        entry["location"] = _simplify_location(item["location"])

    # Garmin exposes whether an event is the athlete's primary event.
    if customization.get("isPrimaryEvent") is not None:
        entry["isPrimaryEvent"] = bool(
            customization["isPrimaryEvent"]
        )

    # Garmin also identifies events involved in training planning.
    if customization.get("isTrainingEvent") is not None:
        entry["isTrainingEvent"] = bool(
            customization["isTrainingEvent"]
        )

    # Three states, not two. A customization object means Garmin is speaking
    # about this event's goal, so no customGoal is a deletion and is recorded as
    # None - the tombstone write_upcoming_races needs to tell it apart from
    # silence. No customization object at all is silence. A goal Garmin sent but
    # this code cannot read (a distance goal, say) is neither: leaving the key
    # off keeps whatever was already on file.
    reported = item.get("eventCustomization")

    if isinstance(reported, dict):
        custom_goal = reported.get("customGoal")
        target_seconds = _extract_target_seconds(custom_goal)

        if custom_goal is None:
            entry["targetSeconds"] = None
        elif target_seconds is not None:
            entry["targetSeconds"] = target_seconds

    return entry


def _event_uuid(item: dict) -> str | None:
    """Return a real Garmin shareable UUID, never a synthesized fallback."""

    value = item.get("garminEventUuid")
    if value is None:
        value = item.get("shareableEventUuid")
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _numeric_event_id(item: dict) -> int | None:
    """Normalize Garmin's numeric event id from API or persisted data."""

    value = item.get("garminEventId")
    if value is None:
        value = item.get("id")
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, float):
        return int(value) if value > 0 and value.is_integer() else None
    if isinstance(value, str):
        normalized = value.strip()
        if normalized.isdigit() and int(normalized) > 0:
            return int(normalized)
    return None


def _event_identity_keys(
    item: dict,
    *,
    include_fallback: bool = False,
) -> list[tuple[str, str]]:
    """Return event identities in Garmin-preferred lookup order.

    UUID and numeric id are both retained as aliases when both are present, so
    differently shaped copies of the same Garmin event still deduplicate. The
    date/name identity is used as the primary identity only when Garmin supplied
    neither stable identifier. Persistence lookup may opt into it as a final
    compatibility fallback for older files.
    """

    keys: list[tuple[str, str]] = []
    event_uuid = _event_uuid(item)
    event_id = _numeric_event_id(item)

    if event_uuid is not None:
        keys.append(("uuid", event_uuid))
    if event_id is not None:
        keys.append(("id", str(event_id)))

    if include_fallback or not keys:
        event_date = item.get("date")
        event_name = item.get("name") or item.get("eventName")
        if isinstance(event_date, str) and isinstance(event_name, str):
            normalized_date = event_date.strip()
            normalized_name = event_name.strip().casefold()
            if normalized_date and normalized_name:
                keys.append(
                    ("date_name", f"{normalized_date}:{normalized_name}")
                )

    return keys


def _event_identity_rank(item: dict) -> int:
    """Rank identities so deduplication retains the strongest representation."""

    if _event_uuid(item) is not None:
        return 0
    if _numeric_event_id(item) is not None:
        return 1
    return 2


def _extract_target_seconds(custom_goal: dict | None) -> int | None:
    """Extract a Garmin custom time goal as whole seconds."""

    if not isinstance(custom_goal, dict):
        return None

    if str(custom_goal.get("unitType", "")).lower() != "time":
        return None

    if str(custom_goal.get("unit", "")).lower() not in {"second", "seconds"}:
        return None

    value = custom_goal.get("value")
    if isinstance(value, bool):
        return None
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        return None
    return int(round(seconds)) if seconds > 0 else None


def _strip_distance_suffix(name: str, distance: str) -> str:
    """Drop a trailing "(distance)" suffix duplicating the distance field."""

    if not distance:
        return name

    match = re.search(r"\s*\(([^()]*)\)\s*$", name)

    if not match:
        return name

    normalized_suffix = (
        match.group(1)
        .replace("-", " ")
        .strip()
        .lower()
    )

    normalized_distance = (
        distance
        .replace("-", " ")
        .strip()
        .lower()
    )

    if normalized_suffix != normalized_distance:
        return name

    return name[: match.start()].rstrip()


def _simplify_location(location: str) -> str:
    """Keep the city and drop Garmin's trailing country/region."""

    return location.split(",")[0].strip()


def _format_distance(completion_target: dict | None) -> str:
    if not completion_target:
        return ""

    unit = completion_target.get("unit", "")

    km = (
        completion_target.get("value") or 0
    ) * _UNIT_TO_KM.get(unit, 0)

    if km <= 0:
        return ""

    for standard_km, label in _STANDARD_DISTANCES_KM:
        if (
            abs(km - standard_km) / standard_km
            <= _STANDARD_DISTANCE_TOLERANCE
        ):
            return label

    return f"{km:g} km"


def _print_races(races: list[dict], *, prefix: str) -> None:
    print(f"{prefix}: {len(races)} race(s) found")

    for race in races:
        details = list(
            filter(
                None,
                [
                    race.get("location"),
                    race.get("distance"),
                ],
            )
        )

        suffix = f"  ({' · '.join(details)})" if details else ""

        print(
            f"  {race['date']}  {race['name']}{suffix}"
        )

        primary = race.get("isPrimaryEvent")

        if primary is True:
            print("      primary: yes")
        elif primary is False:
            print("      primary: no")

        target_seconds = race.get("targetSeconds")

        if target_seconds is not None:
            print(
                f"      goal: {_format_duration(target_seconds)}"
            )

        training = race.get("isTrainingEvent")

        if training is not None:
            print(
                "      training event: "
                + ("yes" if training else "no")
            )


def _format_duration(seconds: int) -> str:
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)

    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"

    return f"{minutes}:{secs:02d}"


def _retry_on_429(fn):
    try:
        return fn()

    except GarminAPIError as exc:
        if exc.status_code != 429:
            raise

        print(
            f"  Rate limited, waiting {_RETRY_PAUSE}s…",
            flush=True,
        )

        time.sleep(_RETRY_PAUSE)
        return fn()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync Garmin upcoming races into RunOmics"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
    )

    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
