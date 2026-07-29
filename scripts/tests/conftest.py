import sys
from pathlib import Path

import pytest

# The pipeline modules import each other as top-level packages
# (`from processing.fit_parser import ...`), mirroring how sync.py runs them:
# it prepends scripts/ to sys.path. Do the same for the tests.
sys.path.insert(0, str(Path(__file__).parent.parent))


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
