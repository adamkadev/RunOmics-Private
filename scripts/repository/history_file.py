"""Reading and writing the accumulated history files.

`race_predictions.json`, `threshold_history.json`, `vo2max_history.json`,
`training_status.json` and `fitness_age_history.json` are not caches. Garmin
only serves a rolling window - a few weeks - so each of these files is the only
copy of everything older than that window, built up one nightly sync at a time
over years.

Every one of them was read through `except Exception: return {}` and then
rewritten whole. Those two halves together are a data shredder: any file that
failed to parse was silently treated as empty, the sync folded in the window
Garmin was offering that night, and wrote the result over the top. Years of
history became the last few weeks, with no error, no warning, and nothing left
to recover from - the only copy had just been overwritten.

The write is the other half of it: a plain `write_text` that is interrupted
(a cancelled Actions run, a full disk, a killed process) leaves exactly the
half-written file the reader could not parse. So the failure fed itself.

Two rules here, and they only work together:

  - A file that is absent is empty. A file that is present and unreadable is an
    error, and the sync stops rather than rewriting it from a partial view.
  - A write either lands completely or not at all.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class HistoryFileError(RuntimeError):
    """A history file exists but could not be read as the JSON it should hold."""


def read_history(path: Path) -> dict[str, Any]:
    """The file's contents, `{}` if it does not exist yet.

    Raises `HistoryFileError` if it exists and cannot be parsed, because the
    caller's next move is to overwrite it - and it must not do that from an
    empty starting point it only reached by failing to read.
    """
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise HistoryFileError(
            f"{path} exists but could not be read ({exc}). Refusing to continue: "
            f"this file is the only copy of the history older than Garmin's rolling "
            f"window, and the next step would overwrite it with just that window. "
            f"Restore it from the data repository's git history, then re-run."
        ) from exc

    if not isinstance(payload, dict):
        raise HistoryFileError(f"{path} holds {type(payload).__name__}, expected a JSON object.")

    return payload


def read_history_section(path: Path, key: str) -> dict[str, Any]:
    """One top-level object out of a history file, e.g. its `days` map."""
    section = read_history(path).get(key)
    return section if isinstance(section, dict) else {}


def write_history(path: Path, payload: dict[str, Any]) -> None:
    """Write via a temporary file in the same directory, then rename over.

    `Path.replace` is atomic within a filesystem, so a reader either sees the
    whole previous file or the whole new one - never the truncated middle that
    made `read_history` raise.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)
