#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from diagnostics.model import (
    FEATURE_IDS,
    PROBE_STATUS_VALUES,
    SCHEMA_VERSION,
    SUPPORT_VALUES,
    load_report,
    write_report_atomic,
)

_PROFILE_NAMES = ("adam", "lamiaa")
_COMPARISON_TOP_KEYS = {"schemaVersion", "asOf", "devices", "features"}
_COMPARISON_STATE_KEYS = {"support", "probeStatus", "samples"}


def build_comparison(adam: dict[str, Any], lamiaa: dict[str, Any]) -> dict[str, Any]:
    reports = {"adam": adam, "lamiaa": lamiaa}
    as_of = {report["asOf"] for report in reports.values()}
    if len(as_of) != 1:
        raise ValueError("reports must use the same asOf date")

    comparison = {
        "schemaVersion": SCHEMA_VERSION,
        "asOf": next(iter(as_of)),
        "devices": {
            profile: {
                key: report["device"][key]
                for key in ("name", "firmware")
                if key in report["device"]
            }
            for profile, report in reports.items()
        },
        "features": {
            feature: {
                profile: {
                    key: report["features"][feature][key]
                    for key in ("support", "probeStatus", "samples")
                }
                for profile, report in reports.items()
            }
            for feature in FEATURE_IDS
        },
    }
    validate_comparison(comparison)
    return comparison


def validate_comparison(value: Any) -> None:
    if not isinstance(value, dict) or set(value) != _COMPARISON_TOP_KEYS:
        raise ValueError("invalid comparison fields")
    if value.get("schemaVersion") != SCHEMA_VERSION or not isinstance(value.get("asOf"), str):
        raise ValueError("invalid comparison metadata")
    devices = value.get("devices")
    if not isinstance(devices, dict) or set(devices) != set(_PROFILE_NAMES):
        raise ValueError("invalid comparison profiles")
    for device in devices.values():
        if not isinstance(device, dict) or not set(device).issubset({"name", "firmware"}):
            raise ValueError("invalid comparison device")
        if any(not isinstance(label, str) or not label for label in device.values()):
            raise ValueError("invalid comparison device label")
    features = value.get("features")
    if not isinstance(features, dict) or set(features) != set(FEATURE_IDS):
        raise ValueError("invalid comparison feature set")
    for profiles in features.values():
        if not isinstance(profiles, dict) or set(profiles) != set(_PROFILE_NAMES):
            raise ValueError("invalid comparison feature profiles")
        for state in profiles.values():
            if not isinstance(state, dict) or set(state) != _COMPARISON_STATE_KEYS:
                raise ValueError("invalid comparison feature state")
            if state["support"] not in SUPPORT_VALUES:
                raise ValueError("invalid comparison support")
            if state["probeStatus"] not in PROBE_STATUS_VALUES:
                raise ValueError("invalid comparison probe status")
            if (
                not isinstance(state["samples"], int)
                or isinstance(state["samples"], bool)
                or state["samples"] < 0
            ):
                raise ValueError("invalid comparison sample count")


def comparison_markdown(comparison: dict[str, Any]) -> str:
    validate_comparison(comparison)
    adam_device = comparison["devices"]["adam"].get("name", "unknown device")
    lamiaa_device = comparison["devices"]["lamiaa"].get("name", "unknown device")
    lines = [
        f"# Garmin capability comparison — {comparison['asOf']}",
        "",
        f"| Feature | Adam / {adam_device} | Lamiaa / {lamiaa_device} |",
        "|---|---:|---:|",
    ]
    for feature in FEATURE_IDS:
        states = comparison["features"][feature]
        lines.append(
            f"| `{feature}` | {_format_state(states['adam'])} | {_format_state(states['lamiaa'])} |"
        )
    lines.append("")
    lines.append(
        "`not_observed` means the probe succeeded but found no samples; it does not mean unsupported."
    )
    return "\n".join(lines) + "\n"


def _format_state(state: dict[str, Any]) -> str:
    result = f"{state['support']} ({state['samples']})"
    if state["probeStatus"] != "ok":
        result += f" · {state['probeStatus']}"
    return result


def write_comparison_bundle(
    output_dir: Path, adam: dict[str, Any], lamiaa: dict[str, Any]
) -> None:
    comparison = build_comparison(adam, lamiaa)
    output_dir.mkdir(parents=True, exist_ok=True)
    write_report_atomic(output_dir / "adam.json", adam)
    write_report_atomic(output_dir / "lamiaa.json", lamiaa)
    _write_text_atomic(
        output_dir / "comparison.json",
        json.dumps(comparison, indent=2, sort_keys=True) + "\n",
    )
    _write_text_atomic(output_dir / "comparison.md", comparison_markdown(comparison))


def _write_text_atomic(path: Path, content: str) -> None:
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False
    ) as handle:
        temp_path = Path(handle.name)
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    try:
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare two sanitized Garmin capability reports")
    parser.add_argument("--adam", type=Path, required=True)
    parser.add_argument("--lamiaa", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        adam = load_report(args.adam)
        lamiaa = load_report(args.lamiaa)
        write_comparison_bundle(args.output_dir, adam, lamiaa)
    except Exception:
        print("Error: sanitized reports could not be compared.", file=sys.stderr)
        return 2
    print("Sanitized Adam/Lamiaa comparison bundle written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
