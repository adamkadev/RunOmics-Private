"""The errors every Garmin client raises, whichever API it reads.

Kept apart from client.py so that a client which needs no Connect
credential - personal_api.py - does not import garminconnect to raise them.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime


class GarminAuthError(Exception):
    pass


class GarminAPIError(Exception):
    def __init__(self, status_code: int, url: str, *, retry_after: float | None = None) -> None:
        super().__init__(f"HTTP {status_code} from {url}")
        self.status_code = status_code
        self.retry_after = retry_after


def retry_after_seconds(headers: Mapping[str, str], now: datetime | None = None) -> float | None:
    """A Retry-After header in seconds, whether given as a delay or as an HTTP date; None when absent or unreadable."""
    value = (headers.get("retry-after") or "").strip()
    if not value:
        return None
    if value.isdigit():
        return float(value)
    try:
        when = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if when.tzinfo is None:
        return None
    return max(0.0, (when - (now or datetime.now(UTC))).total_seconds())


class GarminTokenExpired(GarminAuthError):
    """Garmin refused GARMIN_SECRET's refresh token: Connect is gone until a new one is minted."""
