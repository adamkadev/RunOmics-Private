"""Connect endpoints a step reads around rather than fails on; sync.py writes the night's list into sync_meta.json."""

from __future__ import annotations

_MESSAGE_LIMIT = 200

_collected: list[dict[str, str]] = []


def warn(step: str, message: str) -> None:
    print(f"  Warning: {message}")
    _collected.append({"step": step, "message": message[:_MESSAGE_LIMIT]})


def collected() -> list[dict[str, str]]:
    return list(_collected)


def reset() -> None:
    _collected.clear()
