from __future__ import annotations

import time
from typing import Callable, TypeVar

import httpx

from .client import GarminAPIError

T = TypeVar("T")

# Exponential backoff for transient failures. 429 gets a long flat pause
# (Garmin's rate-limit window), network errors and 5xx get 2s/8s/32s - GitHub
# Actions runners see both regularly and a single lost request should not
# fail the whole nightly sync.
_RATE_LIMIT_PAUSE = 60.0
_BACKOFF_BASE = 2.0
_MAX_ATTEMPTS = 4


def _is_transient(exc: Exception) -> bool:
    if isinstance(exc, GarminAPIError):
        return exc.status_code == 429 or exc.status_code >= 500
    return isinstance(exc, httpx.HTTPError)  # timeouts, resets, DNS…


def retry_transient(fn: Callable[[], T]) -> T:
    """Run fn, retrying transient Garmin/network errors with backoff.

    Non-transient errors (4xx other than 429) are raised immediately.
    """
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            return fn()
        except Exception as exc:
            if not _is_transient(exc) or attempt == _MAX_ATTEMPTS:
                raise
            if isinstance(exc, GarminAPIError) and exc.status_code == 429:
                pause = _RATE_LIMIT_PAUSE
            else:
                pause = _BACKOFF_BASE * (4 ** (attempt - 1))
            print(f"transient error ({exc}), retry {attempt}/{_MAX_ATTEMPTS - 1} in {pause:.0f}s…", flush=True)
            time.sleep(pause)
    raise AssertionError("unreachable")
