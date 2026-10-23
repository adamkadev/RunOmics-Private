from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any, TypeVar

import httpx

from .errors import GarminAPIError

T = TypeVar("T")

# 429 waits out Garmin's rate-limit window; network errors and 5xx back off 2s/8s/32s,
# because GitHub Actions runners see both regularly.
_RATE_LIMIT_PAUSE = 60.0
_BACKOFF_BASE = 2.0
_MAX_ATTEMPTS = 4


def _is_transient(exc: Exception) -> bool:
    if isinstance(exc, GarminAPIError):
        return exc.status_code == 429 or exc.status_code >= 500
    return isinstance(exc, httpx.HTTPError)


def retry_transient(fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """The arguments are passed through so a call made inside a loop needs no closure over the loop variable."""
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            return fn(*args, **kwargs)
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
