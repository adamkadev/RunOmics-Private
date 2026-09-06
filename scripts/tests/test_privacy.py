import json

import pytest

from processing.privacy import (
    PrivacyConfigError,
    crop_privacy_zone,
    is_confirmed_race,
    route_for_storage,
)

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


class TestIsConfirmedRace:
    """Only Garmin's own race evidence earns the exemption. `type` reaches
    "Race" solely from ParsedFit.is_race (FIT message 310), and only ever with
    typeSource "garmin"."""

    def test_garmin_classified_race(self):
        assert is_confirmed_race({"type": "Race", "typeSource": "garmin"}) is True

    def test_locally_inferred_race_is_not_confirmed(self):
        assert is_confirmed_race({"type": "Race", "typeSource": "runomics"}) is False

    def test_record_without_a_type_source_is_not_confirmed(self):
        assert is_confirmed_race({"type": "Race"}) is False

    def test_ordinary_activity_is_not_a_race(self):
        assert is_confirmed_race({"type": "Base", "typeSource": "garmin"}) is False
        assert is_confirmed_race({}) is False

    def test_a_name_never_makes_a_race(self):
        assert is_confirmed_race(
            {"type": "Base", "typeSource": "garmin", "description": "Race the sunset"}
        ) is False


class TestRouteForStorage:
    def test_a_normal_activity_is_still_cropped(self):
        route = [[0.0, 0.0], [1.0, 1.0], [2.0, 2.0], [0.0, 0.0]]

        assert route_for_storage(route, is_race=False) == [[1.0, 1.0], [2.0, 2.0]]

    def test_a_race_keeps_its_start_and_finish(self):
        route = [[0.0, 0.0], [1.0, 1.0], [2.0, 2.0], [0.0, 0.0]]

        assert route_for_storage(route, is_race=True) == route

    def test_a_race_route_entirely_inside_a_zone_survives_whole(self):
        # Cropping would return None here; the exemption keeps the course.
        route = [[0.0, 0.0], [0.0001, 0.0001]]

        assert route_for_storage(route, is_race=True) == route

    def test_missing_route_is_none_either_way(self, monkeypatch):
        monkeypatch.delenv("PRIVACY_ZONES", raising=False)
        monkeypatch.delenv("PRIVACY_RADIUS_M", raising=False)

        assert route_for_storage(None, is_race=False) is None
        assert route_for_storage([], is_race=False) is None
        assert route_for_storage(None, is_race=True) is None

    def test_a_non_race_still_fails_loudly_without_config(self, monkeypatch):
        monkeypatch.delenv("PRIVACY_ZONES", raising=False)

        with pytest.raises(PrivacyConfigError):
            route_for_storage([[1.0, 1.0], [2.0, 2.0]], is_race=False)
