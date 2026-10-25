from __future__ import annotations

from typing import Any

from garmin_fit_sdk import Decoder, Profile, Stream

_UNKNOWN = "unknown"


def strength_sets(content: bytes) -> list[dict[str, Any]]:
    """The work sets a strength activity's FIT file records, in order; [] for a file with none or one that will not decode."""
    try:
        messages, _errors = Decoder(Stream.from_byte_array(bytearray(content))).read()
    except Exception:
        return []
    return sets_from_messages(messages or {})


def sets_from_messages(messages: dict[str, Any]) -> list[dict[str, Any]]:
    sets: list[dict[str, Any]] = []
    for message in messages.get("set_mesgs", []):
        if not isinstance(message, dict) or message.get("set_type") == "rest":
            continue
        category = _first(message.get("category"))
        category = category if isinstance(category, str) and category != _UNKNOWN else None
        entry: dict[str, Any] = {
            "category": category,
            "exercise": _exercise_name(category, _first(message.get("category_subtype"))),
            "reps": _int(message.get("repetitions")),
            "weightKg": _rounded(message.get("weight"), 1),
            "durationSeconds": _int(message.get("duration")),
        }
        set_ = {key: value for key, value in entry.items() if value is not None}
        if set_:
            sets.append(set_)
    return sets


def _first(value: Any) -> Any:
    # The SDK decodes a one-element array field as the element itself.
    return value[0] if isinstance(value, list) and value else value


def _exercise_name(category: str | None, subtype: Any) -> str | None:
    if category is None or not isinstance(subtype, int):
        return None
    name = Profile["types"].get(f"{category}_exercise_name", {}).get(subtype)
    return name if isinstance(name, str) else None


def _int(value: Any) -> int | None:
    return round(value) if isinstance(value, (int, float)) and value >= 0 else None


def _rounded(value: Any, digits: int) -> float | None:
    return round(float(value), digits) if isinstance(value, (int, float)) and value > 0 else None
