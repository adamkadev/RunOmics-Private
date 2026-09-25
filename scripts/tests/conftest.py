import json
import os
import socket
import sys
import tempfile
from pathlib import Path

import pytest

# Before anything imports a pipeline module: most of them resolve their data
# paths at import time, from this variable. Left unset, a test that forgot to
# re-point one would read - or write - the developer's real dataset under
# ./data. The directory is removed when the session ends.
_SESSION_DATA_DIR = tempfile.TemporaryDirectory(prefix="runomics-test-data-")
os.environ["RUNOMICS_DATA_DIR"] = _SESSION_DATA_DIR.name

# The pipeline modules import each other as top-level packages
# (`from processing.fit_parser import ...`), mirroring how sync.py runs them:
# it prepends scripts/ to sys.path. Do the same for the tests.
sys.path.insert(0, str(Path(__file__).parent.parent))

# Fictional - nowhere near any real running route. Overrides whatever a
# developer's shell happens to have exported, so a test can never read real
# privacy-zone coordinates even by accident.
_FICTIONAL_PRIVACY_ZONES = [[0.0, 0.0], [10.0, 10.0]]
_FICTIONAL_PRIVACY_RADIUS_M = 500


@pytest.fixture(autouse=True)
def fictional_privacy_zones(monkeypatch):
    monkeypatch.setenv("PRIVACY_ZONES", json.dumps(_FICTIONAL_PRIVACY_ZONES))
    monkeypatch.setenv("PRIVACY_RADIUS_M", str(_FICTIONAL_PRIVACY_RADIUS_M))


class NetworkBlocked(RuntimeError):
    """A test reached for the network."""


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Fail any test that opens a connection or resolves a host name.

    Garmin, Open-Meteo and the proxy all sit behind these three calls
    (httpx, urllib and garth's requests all end in socket.create_connection,
    which resolves through socket.getaddrinfo). The refusal raises - so
    nothing goes out - and is also recorded, because much of the pipeline
    catches broad exceptions on purpose: a test whose code swallowed it still
    fails at teardown. The record is what the fixture yields, for the one
    test that trips it on purpose.
    """
    attempts: list[str] = []

    def refuse(target):
        attempts.append(repr(target))
        raise NetworkBlocked(f"tests must not use the network (tried {target!r})")

    monkeypatch.setattr(socket.socket, "connect", lambda _self, address: refuse(address))
    monkeypatch.setattr(socket.socket, "connect_ex", lambda _self, address: refuse(address))
    monkeypatch.setattr(socket, "getaddrinfo", lambda host, *_args, **_kwargs: refuse(host))
    yield attempts
    if attempts:
        pytest.fail(f"the test reached for the network: {', '.join(attempts)}")


@pytest.fixture
def activity_factory():
    """Builds an ActivityData with only id and date meaningful - every other
    field is a placeholder, so a store test reads as the two values it is about."""
    from processing.mapper import ActivityData

    def make(activity_id: str, date: str):
        return ActivityData(
            id=activity_id,
            week=0,
            date=date,
            day_of_week="Saturday",
            type="Easy",
            description="",
            duration_seconds=1800,
            distance_km=5.0,
            pace_sec_per_km=360.0,
            hr_zones=[],
            avg_heart_rate=None,
            rpe=None,
            comment="",
            polyline=None,
            route=None,
            elevation_gain=None,
            aer_training_effect=None,
            ana_training_effect=None,
            hr_samples=None,
            elevation_profile=None,
            calories=None,
            cadence_spm=None,
            ground_contact_ms=None,
            vertical_oscillation_mm=None,
            vertical_ratio_pct=None,
            stride_length_m=None,
            best_efforts=None,
            splits=None,
            pace_samples=None,
            vo2max_garmin=None,
            avg_temperature=None,
            cadence_samples=None,
            gear_id=None,
        )

    return make
