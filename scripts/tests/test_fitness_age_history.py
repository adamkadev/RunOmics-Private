import json
from datetime import date

import garmin.fitness_age_history as history
from garmin.fitness_age_history import normalize_weekly_fitness_age, sync_fitness_age_history


def test_normalizes_weekly_fitness_age_and_bmi_without_rhr():
    rows = [
        {
            "calendarDate": "2026-06-13",
            "values": {
                "fitnessAge": 22.13333221646812,
                "achievableFitnessAge": 18.0,
                "rhr": 118.5,
                "bmi": 20.509878446699418,
            },
        }
    ]

    assert normalize_weekly_fitness_age(rows) == {
        "2026-06-13": {
            "fitnessAgeYrs": 22.1,
            "achievableFitnessAgeYrs": 18.0,
            "bmi": 20.5,
        }
    }


def test_weekly_history_sync_merges_without_discarding_older_stale_data(
    tmp_path, monkeypatch
):
    path = tmp_path / "fitness_age_history.json"
    path.write_text(
        json.dumps({"weeks": {"2025-01-04": {"fitnessAgeYrs": 23.0}}})
    )
    monkeypatch.setattr(history, "_PATH", path)

    class Client:
        def get_fitness_age_weekly(self, day, weeks):
            assert day == "2026-08-28"
            assert weeks == 52
            return [
                {
                    "calendarDate": "2026-06-13",
                    "values": {"fitnessAge": 22.1, "bmi": 20.5},
                }
            ]

    assert sync_fitness_age_history(Client(), today=date(2026, 8, 28)) == 2
    assert json.loads(path.read_text()) == {
        "weeks": {
            "2025-01-04": {"fitnessAgeYrs": 23.0},
            "2026-06-13": {"fitnessAgeYrs": 22.1, "bmi": 20.5},
        }
    }


def test_empty_weekly_200_is_legitimate_and_preserves_existing_file(
    tmp_path, monkeypatch
):
    path = tmp_path / "fitness_age_history.json"
    original = {"weeks": {"2026-06-13": {"fitnessAgeYrs": 22.1}}}
    path.write_text(json.dumps(original))
    monkeypatch.setattr(history, "_PATH", path)

    class Client:
        def get_fitness_age_weekly(self, _day, _weeks):
            return []

    assert sync_fitness_age_history(Client(), today=date(2026, 8, 28)) == 1
    assert json.loads(path.read_text()) == original
