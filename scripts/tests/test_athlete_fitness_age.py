from garmin.athlete import extract_fitness_age


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
