import pytest

from garmin.client import GarminAPIError, GarminClient


@pytest.mark.parametrize("method,args", [
    ("get_hr_zones", ("activity",)),
    ("get_activity_gear", ("activity",)),
    ("download_fit", ("activity",)),
])
def test_optional_activity_resources_keep_production_default(method, args):
    client = object.__new__(GarminClient)
    client._base = "https://example.test"

    def fail(*_args, **_kwargs):
        raise GarminAPIError(503, "https://example.test/private-id")

    client._get = fail

    empty = getattr(client, method)(*args)
    assert empty == ([] if method != "download_fit" else None)


@pytest.mark.parametrize("method,args", [
    ("get_hr_zones", ("activity",)),
    ("get_activity_gear", ("activity",)),
    ("download_fit", ("activity",)),
])
def test_diagnostic_strict_mode_propagates_errors(method, args):
    client = object.__new__(GarminClient)
    client._base = "https://example.test"

    def fail(*_args, **_kwargs):
        raise GarminAPIError(503, "https://example.test/private-id")

    client._get = fail

    with pytest.raises(GarminAPIError):
        getattr(client, method)(*args, strict_errors=True)
