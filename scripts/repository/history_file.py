"""Garmin only serves a rolling window, so these files are the only copy of everything older than it.

A file that is present but unreadable is an error rather than an empty start, because the caller's next move is to
rewrite it.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from repository.atomic_write import write_text_atomic


class HistoryFileError(RuntimeError):
    """A history file exists but could not be read as the JSON it should hold."""


def read_history(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}

    # UTF-8 explicitly, as it is written: the locale default on Windows would
    # decode an accented name into something the next write then persists.
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HistoryFileError(
            f"{path} exists but could not be read ({exc}). Refusing to continue: "
            f"the next step would overwrite it. Restore it from the data "
            f"repository's git history, then re-run."
        ) from exc

    if not isinstance(payload, dict):
        raise HistoryFileError(f"{path} holds {type(payload).__name__}, expected a JSON object.")

    return payload


def read_history_section(path: Path, key: str) -> dict[str, Any]:
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
    write_text_atomic(path, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
