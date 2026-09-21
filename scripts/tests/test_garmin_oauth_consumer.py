"""The Garmin sync must not depend on a bucket belonging to an abandoned project."""

import garth.sso
import pytest

from garmin import client as garmin_client


@pytest.fixture(autouse=True)
def _reset_consumer(monkeypatch):
    monkeypatch.setattr(garth.sso, "OAUTH_CONSUMER", {}, raising=False)
    monkeypatch.delenv(garmin_client._CONSUMER_KEY_ENV, raising=False)
    monkeypatch.delenv(garmin_client._CONSUMER_SECRET_ENV, raising=False)


def _forbid_network(monkeypatch):
    """Any attempt to reach garth's S3 bucket becomes a test failure."""
    def poisoned(*args, **_kwargs):
        raise AssertionError(f"network fetch attempted: {args[:1]}")

    monkeypatch.setattr(garth.sso.requests, "get", poisoned)


def test_seeded_consumer_leaves_garth_nothing_to_fetch(monkeypatch):
    _forbid_network(monkeypatch)
    monkeypatch.setenv(garmin_client._CONSUMER_KEY_ENV, "key-from-secret")
    monkeypatch.setenv(garmin_client._CONSUMER_SECRET_ENV, "secret-from-secret")

    garmin_client._seed_oauth_consumer()

    session = garth.sso.GarminOAuth1Session()
    assert session.auth.client.client_key == "key-from-secret"


def test_unseeded_consumer_keeps_garths_own_behaviour(monkeypatch):
    """Without the variables the fallback must stay intact, not break."""
    fetched = []

    class _Payload:
        @staticmethod
        def json():
            return {"consumer_key": "from-bucket", "consumer_secret": "also-from-bucket"}

    def record(url, **_kwargs):
        fetched.append(url)
        return _Payload()

    monkeypatch.setattr(garth.sso.requests, "get", record)

    garmin_client._seed_oauth_consumer()

    garth.sso.GarminOAuth1Session()
    assert fetched == [garth.sso.OAUTH_CONSUMER_URL]


@pytest.mark.parametrize(
    "key,secret",
    [("", "secret"), ("key", ""), ("  ", "secret")],
    ids=["no-key", "no-secret", "blank-key"],
)
def test_a_half_configured_consumer_is_not_used(monkeypatch, key, secret):
    """Seeding half a credential would fail the exchange more confusingly than fetching."""
    monkeypatch.setenv(garmin_client._CONSUMER_KEY_ENV, key)
    monkeypatch.setenv(garmin_client._CONSUMER_SECRET_ENV, secret)

    garmin_client._seed_oauth_consumer()

    assert garth.sso.OAUTH_CONSUMER == {}
