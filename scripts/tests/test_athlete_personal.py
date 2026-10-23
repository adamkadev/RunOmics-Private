from datetime import date

from garmin.athlete import fetch_personal_athlete_metrics, latest_weight_kg
from garmin.errors import GarminAPIError

TODAY = date(2026, 10, 23)


def _zones(sport, floors, *, max_hr, resting, lthr):
    return {
        "sport": sport,
        **{f"zone{n}Floor": floor for n, floor in enumerate(floors, 1)},
        "maxHeartRateUsed": max_hr,
        "restingHeartRateUsed": resting,
        "lactateThresholdHeartRateUsed": lthr,
    }


class FakePersonal:
    """Fictional values, in the shapes the Personal API answered in Oct 2026."""

    def __init__(self, **answers):
        self.answers = {
            "zones": [
                _zones("DEFAULT", (100, 120, 140, 160, 180), max_hr=190, resting=50, lthr=170),
                _zones("RUNNING", (112, 136, 152, 162, 172), max_hr=192, resting=48, lthr=171.6),
            ],
            "fitness": {"chronologicalAge": 31, "fitnessAge": 24.43, "components": {"bmi": {"value": 22.1}},
                        "lastUpdated": "2026-10-22T05:00:00.0"},
            "weight": {"dailyWeightSummaries": [
                {"summaryDate": "2026-10-20", "latestWeight": {"weight": 68400.0}},
                {"summaryDate": "2026-09-02", "latestWeight": {"weight": 69100.0}},
            ]},
            **answers,
        }

    def _answer(self, name):
        answer = self.answers[name]
        if isinstance(answer, Exception):
            raise answer
        return answer

    def get_heart_rate_zones(self):
        return self._answer("zones")

    def get_current_fitness_age(self, _day):
        return self._answer("fitness")

    def get_weight_range(self, _start, _end):
        return self._answer("weight")


def test_reads_the_running_zones_lthr_age_fitness_age_and_the_last_weigh_in():
    metrics = fetch_personal_athlete_metrics(FakePersonal(), TODAY)

    assert metrics.pop("lastUpdate")
    assert metrics == {
        "hrZoneBoundsBpm": [112, 136, 152, 162, 172],
        "maxHrBpm": 192,
        "restingHrBpm": 48,
        "lthrBpm": 172,
        "age": 31,
        "fitnessAgeYrs": 24.4,
        "bmi": 22.1,
        "fitnessAgeLastUpdated": "2026-10-22T05:00:00",
        "weightKg": 68.4,
    }


def test_a_failing_part_leaves_only_its_own_metrics_out():
    metrics = fetch_personal_athlete_metrics(
        FakePersonal(fitness=GarminAPIError(500, "u"), weight=GarminAPIError(404, "u")), TODAY
    )

    assert metrics["lthrBpm"] == 172
    assert not {"age", "fitnessAgeYrs", "weightKg"} & set(metrics)


def test_nothing_known_is_nothing_written():
    metrics = fetch_personal_athlete_metrics(
        FakePersonal(zones=[], fitness={}, weight={"dailyWeightSummaries": []}), TODAY
    )

    assert metrics == {}


def test_latest_weight_kg_takes_the_newest_weigh_in_in_kg():
    assert latest_weight_kg(FakePersonal().answers["weight"]) == 68.4
    assert latest_weight_kg({"dailyWeightSummaries": [{"summaryDate": "2026-10-20", "latestWeight": {}}]}) is None
    assert latest_weight_kg(None) is None
