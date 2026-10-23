from garmin.race_predictions import merge_days, normalize_prediction


def test_keeps_every_predicted_distance():
    entry = {
        "calendarDate": "2026-07-21",
        "time5K": 1234,
        "time10K": 2567,
        "timeHalfMarathon": 5678,
        "timeMarathon": 12345,
    }

    assert normalize_prediction(entry) == (
        "2026-07-21",
        {"5k": 1234, "10k": 2567, "half": 5678, "marathon": 12345},
    )


def test_ignores_the_envelope_fields_garmin_repeats_on_every_row():
    entry = {
        "userId": 133047860,
        "fromCalendarDate": "2026-06-29",
        "toCalendarDate": "2026-07-21",
        "calendarDate": "2026-06-29",
        "time5K": 1179,
        "time10K": 2492,
        "timeHalfMarathon": 5509,
        "timeMarathon": 12136,
    }

    assert normalize_prediction(entry) == (
        "2026-06-29",
        {"5k": 1179, "10k": 2492, "half": 5509, "marathon": 12136},
    )


def test_drops_distances_the_watch_could_not_predict():
    entry = {"calendarDate": "2026-07-21", "time5K": 1234, "timeMarathon": None}

    assert normalize_prediction(entry) == ("2026-07-21", {"5k": 1234})


def test_drops_a_day_with_no_prediction_at_all():
    # Before the watch has enough history the keys are present but empty.
    assert normalize_prediction({"calendarDate": "2026-07-21", "time5K": None}) is None
    assert normalize_prediction({"calendarDate": "2026-07-21", "time5K": 0}) is None
    assert normalize_prediction({"time5K": 1234}) is None
    assert normalize_prediction(None) is None


def test_merge_keeps_days_outside_the_fetched_window():
    # Garmin only serves a few recent weeks, so older days survive only because a previous sync stored them.
    stored = {"2026-01-01": {"5k": 1300}}

    merge_days(stored, [{"calendarDate": "2026-07-21", "time5K": 1220}])

    assert stored == {"2026-01-01": {"5k": 1300}, "2026-07-21": {"5k": 1220}}


def test_merge_overwrites_a_revised_day():
    stored = {"2026-07-21": {"5k": 1300}}

    assert merge_days(stored, [{"calendarDate": "2026-07-21", "time5K": 1220}]) == 1
    assert stored["2026-07-21"] == {"5k": 1220}


def test_merge_tolerates_an_empty_response():
    stored = {"2026-07-21": {"5k": 1220}}

    assert merge_days(stored, None) == 0
    assert merge_days(stored, []) == 0
    assert stored == {"2026-07-21": {"5k": 1220}}
