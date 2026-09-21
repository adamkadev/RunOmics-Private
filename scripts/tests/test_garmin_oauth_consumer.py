"""The Garmin sync must not depend on a bucket belonging to an abandoned project."""

import garth.sso
import pytest

from garmin import client as garmin_client


@pytest.fixture(autouse=True)
def _forbid_network(monkeypatch):
    """Any attempt to reach garth's S3 bucket fails the test that caused it."""
    monkeypatch.setattr(garth.sso, "OAUTH_CONSUMER", {}, raising=False)
    monkeypatch.delenv(garmin_client._CONSUMER_KEY_ENV, raising=False)
    monkeypatch.delenv(garmin_client._CONSUMER_SECRET_ENV, raising=False)

    def poisoned(*args, **_kwargs):
        raise AssertionError(f"network fetch attempted: {args[:1]}")

    monkeypatch.setattr(garth.sso.requests, "get", poisoned)


def test_the_bundled_consumer_is_used_with_nothing_configured():
    """No setup step: the sync has to be bucket-free out of the box."""
    garmin_client._seed_oauth_consumer()

    session = garth.sso.GarminOAuth1Session()
    assert session.auth.client.client_key == garmin_client._OAUTH_CONSUMER["consumer_key"]


def test_the_environment_overrides_the_bundled_consumer(monkeypatch):
    """The escape hatch for the day Garmin rotates the pair."""
    monkeypatch.setenv(garmin_client._CONSUMER_KEY_ENV, "rotated-key")
    monkeypatch.setenv(garmin_client._CONSUMER_SECRET_ENV, "rotated-secret")

    garmin_client._seed_oauth_consumer()

    session = garth.sso.GarminOAuth1Session()
    assert session.auth.client.client_key == "rotated-key"


@pytest.mark.parametrize(
    "key,secret",
    [("", "secret"), ("key", ""), ("  ", "secret")],
    ids=["no-key", "no-secret", "blank-key"],
)
def test_a_half_set_override_falls_back_rather_than_half_applying(monkeypatch, key, secret):
    monkeypatch.setenv(garmin_client._CONSUMER_KEY_ENV, key)
    monkeypatch.setenv(garmin_client._CONSUMER_SECRET_ENV, secret)

    garmin_client._seed_oauth_consumer()

    assert garth.sso.OAUTH_CONSUMER == garmin_client._OAUTH_CONSUMER


def test_seeding_cannot_be_mutated_through_the_module_constant():
    """garth hands its global around; a shared dict would let a caller corrupt the default."""
    garmin_client._seed_oauth_consumer()
    garth.sso.OAUTH_CONSUMER["consumer_key"] = "tampered"

    garmin_client._seed_oauth_consumer()
    assert garth.sso.OAUTH_CONSUMER["consumer_key"] == garmin_client._OAUTH_CONSUMER["consumer_key"]
