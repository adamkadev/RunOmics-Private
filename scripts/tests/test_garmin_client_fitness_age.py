from garmin.client import GarminClient


class JsonResponse:
    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


def test_current_fitness_age_endpoint():
    client = object.__new__(GarminClient)
    client._base = "https://example.test"
    calls = []
    client._get = lambda url: calls.append(url) or JsonResponse({"fitnessAge": 22.3})

    assert client.get_current_fitness_age("2026-08-28") == {"fitnessAge": 22.3}
    assert calls == [
        "https://example.test/fitnessage-service/fitnessage/2026-08-28"
    ]


def test_weekly_fitness_age_endpoint_uses_fixed_history_length():
    client = object.__new__(GarminClient)
    client._base = "https://example.test"
    calls = []
    client._get = lambda url: calls.append(url) or JsonResponse([])

    assert client.get_fitness_age_weekly("2026-08-28") == []
    assert calls == [
        "https://example.test/fitnessage-service/stats/weekly/2026-08-28/52"
    ]
