import json

import pytest

from processing.privacy import PrivacyConfigError, crop_privacy_zone

# The fictional_privacy_zones autouse fixture (conftest.py) sets PRIVACY_ZONES
# to [[0.0, 0.0], [10.0, 10.0]] and PRIVACY_RADIUS_M to 500 for every test in
# this suite; tests below override it where they need a different config.


class TestCropPrivacyZone:
    def test_crops_leading_and_trailing_points_inside_a_zone(self):
        route = [[0.0, 0.0], [0.0001, 0.0001], [1.0, 1.0], [2.0, 2.0], [0.0002, 0.0002], [0.0, 0.0]]
        assert crop_privacy_zone(route) == [[1.0, 1.0], [2.0, 2.0]]

    def test_route_entirely_inside_a_zone_becomes_none(self):
        route = [[0.0, 0.0], [0.0001, 0.0001]]
        assert crop_privacy_zone(route) is None

    def test_route_outside_every_zone_is_untouched(self):
        route = [[50.0, 50.0], [51.0, 51.0]]
        assert crop_privacy_zone(route) == route

    def test_supports_multiple_zones(self):
        route = [[10.0, 10.0], [5.0, 5.0], [4.0, 4.0], [0.0, 0.0]]
        assert crop_privacy_zone(route) == [[5.0, 5.0], [4.0, 4.0]]

    def test_none_or_empty_route_never_needs_config(self, monkeypatch):
        monkeypatch.delenv("PRIVACY_ZONES", raising=False)
        monkeypatch.delenv("PRIVACY_RADIUS_M", raising=False)

        assert crop_privacy_zone(None) is None
        assert crop_privacy_zone([]) == []


class TestPrivacyConfigRequired:
    """A real route with no (or malformed) config must fail loudly, never
    silently persist unredacted GPS."""

    def test_raises_when_zones_missing(self, monkeypatch):
        monkeypatch.delenv("PRIVACY_ZONES", raising=False)

        with pytest.raises(PrivacyConfigError):
            crop_privacy_zone([[1.0, 1.0], [2.0, 2.0]])

    def test_raises_when_radius_missing(self, monkeypatch):
        monkeypatch.delenv("PRIVACY_RADIUS_M", raising=False)

        with pytest.raises(PrivacyConfigError):
            crop_privacy_zone([[1.0, 1.0], [2.0, 2.0]])

    def test_raises_on_malformed_zones_json(self, monkeypatch):
        monkeypatch.setenv("PRIVACY_ZONES", "not-json")

        with pytest.raises(PrivacyConfigError):
            crop_privacy_zone([[1.0, 1.0], [2.0, 2.0]])

    def test_raises_on_non_positive_radius(self, monkeypatch):
        monkeypatch.setenv("PRIVACY_RADIUS_M", "0")

        with pytest.raises(PrivacyConfigError):
            crop_privacy_zone([[1.0, 1.0], [2.0, 2.0]])

    def test_raises_on_empty_zones_list(self, monkeypatch):
        monkeypatch.setenv("PRIVACY_ZONES", json.dumps([]))

        with pytest.raises(PrivacyConfigError):
            crop_privacy_zone([[1.0, 1.0], [2.0, 2.0]])
