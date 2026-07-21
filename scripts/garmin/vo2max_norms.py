"""Sync Garmin's VO2max reference table to public/data/vo2max_norms.json.

Garmin serves the Cooper Institute age/sex percentile anchors as a static JSON
table. It is the source of truth for the athlete rank badge and the "top X%"
band in the UI, so rather than keeping a hand-copied duplicate in TypeScript we
pull it on every sync and report when Garmin changes it.

The API shape is a list of open-ended bands per bracket:

    {"MALE": {"20-29": [{"category": "Superior", "min": "55.4", "max": ""}, ...]}}

Each band's `min` is its lower anchor, so the four thresholds we need are just
the `min` of Superior/Excellent/Good/Fair. We flatten to the shape the domain
layer consumes:

    {"male": {"20-29": {"superior": 55.4, "excellent": 51.1, ...}}}
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .client import GarminAPIError, GarminClient

_OUT_PATH = Path(__file__).parent.parent.parent / "public" / "data" / "vo2max_norms.json"

_SEXES = {"MALE": "male", "FEMALE": "female"}
_BRACKETS = ("20-29", "30-39", "40-49", "50-59", "60-69", "70-79")
_CATEGORIES = ("Superior", "Excellent", "Good", "Fair")


class Vo2maxNormsError(Exception):
    pass


def fetch_vo2max_norms(client: GarminClient) -> dict[str, Any] | None:
    """Return the normalized norms table, or None if it could not be fetched.

    A failure here must never abort a sync: the committed JSON stays valid
    reference data indefinitely, so we degrade to "keep what we have".
    """
    print("Syncing VO2max norms…")
    try:
        raw = client.get_vo2max_norms()
    except GarminAPIError as exc:
        print(f"  Warning: VO2max norms fetch failed: {exc}")
        return None

    try:
        return normalize_vo2max_norms(raw)
    except Vo2maxNormsError as exc:
        print(f"  Warning: unexpected VO2max norms payload: {exc}")
        return None


def normalize_vo2max_norms(raw: dict[str, Any]) -> dict[str, Any]:
    norms: dict[str, Any] = {}

    for api_sex, sex in _SEXES.items():
        brackets = raw.get(api_sex)
        if not isinstance(brackets, dict):
            raise Vo2maxNormsError(f"missing sex {api_sex!r}")

        norms[sex] = {}
        for bracket in _BRACKETS:
            bands = brackets.get(bracket)
            if not isinstance(bands, list):
                raise Vo2maxNormsError(f"missing bracket {api_sex}/{bracket}")

            by_category = {
                band.get("category"): band.get("min")
                for band in bands
                if isinstance(band, dict)
            }
            thresholds = {}
            for category in _CATEGORIES:
                value = by_category.get(category)
                if value in (None, ""):
                    raise Vo2maxNormsError(f"missing {category} min for {api_sex}/{bracket}")
                try:
                    thresholds[category.lower()] = float(value)
                except (TypeError, ValueError) as exc:
                    raise Vo2maxNormsError(
                        f"non-numeric {category} min {value!r} for {api_sex}/{bracket}"
                    ) from exc

            norms[sex][bracket] = thresholds

    return norms


def write_vo2max_norms(norms: dict[str, Any] | None) -> bool:
    """Write the norms table, returning True when the values actually changed."""
    if norms is None:
        return False

    existing: dict[str, Any] | None = None
    if _OUT_PATH.exists():
        try:
            existing = json.loads(_OUT_PATH.read_text())
        except Exception:
            existing = None

    if existing == norms:
        print("  VO2max norms unchanged.")
        return False

    _OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    _OUT_PATH.write_text(json.dumps(norms, indent=2, sort_keys=True) + "\n")

    if existing is None:
        print("  VO2max norms written to vo2max_norms.json")
    else:
        print("  VO2max norms CHANGED on Garmin's side:")
        for line in diff_vo2max_norms(existing, norms):
            print(f"    {line}")

    return True


def diff_vo2max_norms(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    for sex in sorted(set(before) | set(after)):
        old_brackets = before.get(sex) or {}
        new_brackets = after.get(sex) or {}
        for bracket in sorted(set(old_brackets) | set(new_brackets)):
            old = old_brackets.get(bracket) or {}
            new = new_brackets.get(bracket) or {}
            for category in sorted(set(old) | set(new)):
                if old.get(category) != new.get(category):
                    lines.append(
                        f"{sex} {bracket} {category}: {old.get(category)} → {new.get(category)}"
                    )
    return lines
