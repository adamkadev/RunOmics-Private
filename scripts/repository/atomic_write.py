"""Never in place: a torn write turns a history file into one the next sync refuses to read, or misreads and overwrites."""
from __future__ import annotations

import os
from pathlib import Path


def write_text_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Beside the target, so the rename never crosses a filesystem; named
    # after it, so a leftover from a killed run is overwritten by the next.
    tmp = path.with_name(f"{path.name}.tmp")
    try:
        with open(tmp, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        # It must not linger, or the data push would commit it.
        tmp.unlink(missing_ok=True)
