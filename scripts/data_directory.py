"""Single source of truth for the Python sync dataset workspace."""

from __future__ import annotations

import os
from pathlib import Path


_REPOSITORY_ROOT = Path(__file__).resolve().parent.parent


def get_data_dir() -> Path:
    """Return the explicit data workspace or the server-only repository default."""

    configured = os.environ.get("RUNOMICS_DATA_DIR", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return _REPOSITORY_ROOT / "data"
