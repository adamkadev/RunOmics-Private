import io
import zipfile

import httpx
import pytest

from garmin.client import GarminAPIError, GarminClient

_OPTIONAL_RESOURCES = pytest.mark.parametrize(
    "method,empty",
    [("get_hr_zones", []), ("get_activity_gear", []), ("download_fit", None)],
)


class _Response:
    def __init__(self, *, content: bytes = b"", payload=None) -> None:
        self.content = content
        self._payload = payload

    def json(self):
        return self._payload


def _client(answer) -> GarminClient:
    client = object.__new__(GarminClient)
    client._base = "https://example.test"

    def get(url, **_kwargs):
        if isinstance(answer, Exception):
            raise answer
        return answer

    client._get = get
    return client


def _zip(**members: bytes) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return buffer.getvalue()


@_OPTIONAL_RESOURCES
def test_a_404_is_an_activity_without_that_resource(method, empty):
    client = _client(GarminAPIError(404, "https://example.test/private-id"))

    assert getattr(client, method)("activity") == empty


@_OPTIONAL_RESOURCES
@pytest.mark.parametrize(
    "error",
    [GarminAPIError(503, "https://example.test/private-id"), GarminAPIError(429, "u"), httpx.ConnectError("reset")],
    ids=["5xx", "429", "network"],
)
def test_any_other_error_raises_so_it_is_retried_not_stored_as_empty(method, empty, error):
    # A 503 read as "no data" stored the activity without its GPS, samples,
    # splits and best efforts, and nothing ever fetched them again.
    client = _client(error)

    with pytest.raises(type(error)):
        getattr(client, method)("activity")


@_OPTIONAL_RESOURCES
def test_strict_mode_raises_the_404_too(method, empty):
    client = _client(GarminAPIError(404, "https://example.test/private-id"))

    with pytest.raises(GarminAPIError):
        getattr(client, method)("activity", strict_errors=True)


class TestDownloadFit:
    def test_returns_the_fit_file_inside_the_archive(self):
        client = _client(_Response(content=_zip(**{"123_ACTIVITY.fit": b"fit bytes"})))

        assert client.download_fit("123") == b"fit bytes"

    def test_an_archive_without_a_fit_file_is_an_activity_without_one(self):
        # What Garmin serves for an activity imported from a GPX, say.
        client = _client(_Response(content=_zip(**{"123.gpx": b"<gpx/>"})))

        assert client.download_fit("123") is None

    def test_an_empty_download_is_an_activity_without_a_file(self):
        assert _client(_Response(content=b"")).download_fit("123") is None

    def test_a_download_that_is_not_an_archive_raises(self):
        # A corrupt transfer, not a missing file: returning None stored the
        # activity without its track and never fetched it again.
        client = _client(_Response(content=b"<html>Service Unavailable</html>"))

        with pytest.raises(zipfile.BadZipFile):
            client.download_fit("123")


def test_a_body_less_no_data_answer_is_empty_not_a_decode_error():
    # Garmin answers a period without data with 204 and no body. Reading it as
    # JSON raised a JSONDecodeError that failed the recovery step every night.
    client = _client(httpx.Response(204, content=b""))
    client.get_profile_uuid = lambda: "uuid"

    assert client.get_resting_hr_range("2025-09-28", "2025-10-25") == {}
