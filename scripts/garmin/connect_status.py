"""Whether GARMIN_SECRET still opens Garmin Connect; the workflow pushes once when it turns expired."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from data_directory import get_data_dir
from repository.history_file import write_history

EXPIRED = "expired"
ACTIVE = "active"


def connect_status_path() -> Path:
    return get_data_dir() / "connect_status.json"


def read_connect_status(path: Path | None = None) -> dict[str, Any]:
    """{} for a missing or unreadable file: the status only decides whether to warn, and a rewrite loses nothing."""
    try:
        payload = json.loads((path or connect_status_path()).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def record_connect_status(*, expired: bool, today: date | None = None, path: Path | None = None) -> bool:
    """Write the state when it changes and return whether it did; a deployment that never lost Connect gets no file."""
    path = path or connect_status_path()
    was_expired = read_connect_status(path).get("state") == EXPIRED
    if expired == was_expired or (not expired and not path.exists()):
        return False
    state = EXPIRED if expired else ACTIVE
    write_history(path, {"state": state, "since": (today or date.today()).isoformat()})
    return True
