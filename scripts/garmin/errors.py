"""The errors every Garmin client raises, whichever API it reads.

Kept apart from client.py so that a client which does not use garth -
personal_api.py - does not import it to raise them.
"""

from __future__ import annotations


class GarminAuthError(Exception):
    pass


class GarminAPIError(Exception):
    def __init__(self, status_code: int, url: str) -> None:
        super().__init__(f"HTTP {status_code} from {url}")
        self.status_code = status_code
