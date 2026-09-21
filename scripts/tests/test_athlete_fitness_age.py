from garmin.athlete import _fetch_fitness_age, extract_current_fitness_age, extract_fitness_age
from garmin.client import GarminAPIError


def _day(calendar_date, **values):
    return {"calendarDate": calendar_date, "values": values}


def test_takes_the_freshest_day():
    days = [
        _day("2026-07-20", fitnessAge=21.776215576499258, achievableFitnessAge=21.05, bmi=20.7),
        _day("2026-07-21", fitnessAge=21.967891989381453, achievableFitnessAge=21.05165740474679, bmi=20.715693808680545),
    ]

    assert extract_fitness_age(days) == {
        "fitnessAgeYrs": 22.0,
        "achievableFitnessAgeYrs": 21.1,
        "bmi": 20.7,
    }


def test_skips_trailing_days_without_a_fitness_age():
    days = [
        _day("2026-07-20", fitnessAge=19.430365552761263, bmi=20.7),
        _day("2026-07-21"),
        {"calendarDate": "2026-07-22"},
    ]

    assert extract_fitness_age(days)["fitnessAgeYrs"] == 19.4


def test_ignores_the_resting_hr_garmin_bundles_in():
    # The fitness-age series carries its own rhr, computed differently from the
    # zone config one we already sync - keeping it would silently overwrite it.
    days = [_day("2026-07-21", fitnessAge=22.0, rhr=66, bmi=20.7)]

    assert "restingHrBpm" not in extract_fitness_age(days)
    assert "rhr" not in extract_fitness_age(days)


def test_returns_nothing_on_an_empty_series():
    assert extract_fitness_age([]) == {}
    assert extract_fitness_age([_day("2026-07-21")]) == {}


def test_extracts_current_snapshot_with_freshness_metadata():
    payload = {
        "chronologicalAge": 21,
        "fitnessAge": 22.345026279264953,
        "achievableFitnessAge": 18.0,
        "components": {
            "rhr": {"value": 118.5},
            "bmi": {
                "value": 20.5,
                "stale": False,
                "lastMeasurementDate": "2025-09-05",
            },
        },
        "lastUpdated": "2026-06-16T00:00:00.0",
    }

    assert extract_current_fitness_age(payload) == {
        "fitnessAgeYrs": 22.3,
        "achievableFitnessAgeYrs": 18.0,
        "bmi": 20.5,
        "bmiMeasurementDate": "2025-09-05",
        "fitnessAgeLastUpdated": "2026-06-16T00:00:00",
    }


def test_current_snapshot_does_not_replace_canonical_rhr():
    metrics = extract_current_fitness_age(
        {"fitnessAge": 22.0, "components": {"rhr": {"value": 118.5}}}
    )

    assert "rhr" not in metrics
    assert "restingHrBpm" not in metrics


def test_current_snapshot_is_preferred_over_daily_history():
    class Client:
        def get_current_fitness_age(self, _day):
            return {
                "fitnessAge": 22.3,
                "components": {"bmi": {"value": 20.5}},
            }

        def get_fitness_age(self, _start, _end):
            raise AssertionError("daily fallback should not be called")

    assert _fetch_fitness_age(Client()) == {"fitnessAgeYrs": 22.3, "bmi": 20.5}


def test_daily_endpoint_200_empty_is_a_legitimate_empty_fallback():
    class Client:
        def get_current_fitness_age(self, _day):
            raise GarminAPIError(404, "safe-test-endpoint")

        def get_fitness_age(self, _start, _end):
            return []

    assert _fetch_fitness_age(Client()) == {}
