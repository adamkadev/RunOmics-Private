"""Reading and writing the accumulated history files.

Garmin only serves a rolling window, so these files are the only copy of
everything older than it. Two rules, and they only work together: a file that
is present but unreadable is an error rather than an empty start, because the
caller's next move is to rewrite it; and every write is atomic, because a torn
write is what makes a file unreadable in the first place.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class HistoryFileError(RuntimeError):
    """A history file exists but could not be read as the JSON it should hold."""


def read_history(path: Path) -> dict[str, Any]:
    """The file's contents, `{}` if it does not exist yet."""
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise HistoryFileError(
            f"{path} exists but could not be read ({exc}). Refusing to continue: "
            f"the next step would overwrite it. Restore it from the data "
            f"repository's git history, then re-run."
        ) from exc

    if not isinstance(payload, dict):
        raise HistoryFileError(f"{path} holds {type(payload).__name__}, expected a JSON object.")

    return payload


def read_history_section(path: Path, key: str) -> dict[str, Any]:
    """One top-level object out of a history file, e.g. its `days` map."""
    payload = read_history(path)
    if key not in payload:
        return {}

    section = payload[key]
    if not isinstance(section, dict):
        raise HistoryFileError(
            f"{path}[{key!r}] holds {type(section).__name__}, expected a JSON object. "
            f"Refusing to continue: the next step would overwrite this file."
        )
    return section


def write_history(path: Path, payload: dict[str, Any]) -> None:
    """Write via a temporary file, then rename over: readers never see a partial file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.tmp")
    try:
        tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        tmp.replace(path)
    finally:
        tmp.unlink(missing_ok=True)
