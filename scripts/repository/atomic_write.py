"""The one way a data file is replaced: never in place.

A torn write is what turns a history file into one the next sync refuses to
read - or, for a writer that does not check, into one it silently misreads
and then overwrites. So the new content goes to a temporary file beside the
target, is flushed to disk, and is renamed over it: a reader sees the old
file or the new one, never half of either.
"""
from __future__ import annotations

import os
from pathlib import Path


def write_text_atomic(path: Path, text: str) -> None:
    """Replace `path` with `text` (UTF-8, LF line endings), or leave it as it was."""
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
        # Gone already after a successful rename; otherwise it must not
        # linger, or the data push would commit it.
        tmp.unlink(missing_ok=True)
