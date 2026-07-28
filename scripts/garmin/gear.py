"""Sync shoe gear from Garmin Connect into public/data/shoes.json.

Garmin's gear-service/gear/v2/list (queried once for ACTIVE and once for
RETIRED) returns each shoe's brand, model, status and odometer cap directly,
so this no longer needs to be hand-copied from the "Distinct gear seen"
printout scripts/backfill_gear.py used to produce. `alertThresholdKm` and
`dotColor` have no Garmin source and aren't stored here - src/domain/shoe/types.ts
derives them from maxKm/order when it builds SHOE_REGISTRY from this file.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .client import GarminClient
from .retry import retry_transient

_OUT_PATH = Path(__file__).parent.parent.parent / "public" / "data" / "shoes.json"
_DEFAULT_MAX_KM = 1000
_GEAR_TYPE = "SHOES"


@dataclass
class ShoeGear:
    gear_id: str
    brand: str
    model: str
    max_km: int
    retired: bool
    first_use_date: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "gearId": self.gear_id,
            "brand": self.brand,
            "model": self.model,
            "maxKm": self.max_km,
            "retired": self.retired,
            "firstUseDate": self.first_use_date,
        }


def fetch_shoe_gear(client: GarminClient) -> list[ShoeGear]:
    """Active shoes (newest first) followed by retired shoes (newest first)."""
    active = retry_transient(lambda: client.get_gear_list("ACTIVE"))
    retired = retry_transient(lambda: client.get_gear_list("RETIRED"))

    return [_map_gear(item, retired=False) for item in active if item.get("gearType") == _GEAR_TYPE] + [
        _map_gear(item, retired=True) for item in retired if item.get("gearType") == _GEAR_TYPE
    ]


def _map_gear(item: dict[str, Any], *, retired: bool) -> ShoeGear:
    brand = (item.get("brand") or "").strip()
    model = (item.get("model") or "").strip()

    if not model:
        combined = (item.get("customMakeModel") or brand).strip()
        brand, model = _split_combined_name(combined)

    max_meters = item.get("maxUsageDistanceMeters") or 0
    max_km = round(max_meters / 1000) if max_meters else _DEFAULT_MAX_KM

    return ShoeGear(
        gear_id=item["uuid"].replace("-", ""),
        brand=_normalize_brand(brand),
        model=model,
        max_km=max_km,
        retired=retired,
        first_use_date=item.get("firstUseDate"),
    )


def _split_combined_name(combined: str) -> tuple[str, str]:
    parts = combined.split(" ", 1)
    return (parts[0], parts[1]) if len(parts) == 2 else (combined, combined)


def _normalize_brand(brand: str) -> str:
    """Garmin lowercases some brands ("adidas") but not others ("Nike") - title-case only the former."""
    return brand.title() if brand.islower() else brand


def write_shoes_json(shoes: list[ShoeGear], *, path: Path = _OUT_PATH) -> bool:
    """Write shoes.json, returning True if it changed."""
    payload = {"shoes": [shoe.to_dict() for shoe in shoes]}

    existing: dict[str, Any] | None = None
    if path.exists():
        try:
            existing = json.loads(path.read_text())
        except Exception:
            existing = None

    if existing == payload:
        return False

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")
    return True
