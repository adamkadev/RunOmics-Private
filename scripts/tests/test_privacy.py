import json
import math

import pytest

from processing.privacy import PrivacyConfigError, crop_privacy_zone, distance_m

# Metres per degree on the sphere privacy.py measures with, so offsets
# built here come back as exactly the distances they were built from.
_M_PER_DEG = 2 * math.pi * 6_371_000 / 360

# The fictional_privacy_zones autouse fixture (conftest.py) sets PRIVACY_ZONES
# to [[0.0, 0.0], [10.0, 10.0]] and PRIVACY_RADIUS_M to 500 for every test in
# this suite; tests below override it where they need a different config.
_CENTRE = (0.0, 0.0)
_RADIUS_M = 500


def _offset(east_m: float, north_m: float) -> list[float]:
    """A point this many metres east/north of the fictional zone at (0, 0)."""
    return [east_m / _M_PER_DEG, north_m / _M_PER_DEG]


def _ray(bearing_deg: float, length_m: int = 2000, step_m: int = 5) -> list[list[float]]:
    """A dense straight route leaving the zone centre - the worst case, since
    every one of these starts exactly at the place being protected."""
    b = math.radians(bearing_deg)
    return [_offset(math.sin(b) * d, math.cos(b) * d) for d in range(0, length_m + 1, step_m)]


def _to_metres(point: list[float]) -> tuple[float, float]:
    return point[0] * _M_PER_DEG, point[1] * _M_PER_DEG


def _fit_circle(points: list[tuple[float, float]]) -> tuple[float, float]:
    """Least-squares (Kasa) circle fit: the centre an observer would compute
    from a set of route endpoints."""
    sxx = sum(x * x for x, _ in points)
    syy = sum(y * y for _, y in points)
    sxy = sum(x * y for x, y in points)
    sx = sum(x for x, _ in points)
    sy = sum(y for _, y in points)
    n = len(points)
    z = [x * x + y * y for x, y in points]
    b1 = sum(zi * x for zi, (x, _) in zip(z, points, strict=True))
    b2 = sum(zi * y for zi, (_, y) in zip(z, points, strict=True))
    b3 = sum(z)
    # Solve [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]] @ [a, b, c] = [b1, b2, b3].
    m = [[sxx, sxy, sx, b1], [sxy, syy, sy, b2], [sx, sy, n, b3]]
    for col in range(3):
        pivot = max(range(col, 3), key=lambda r: abs(m[r][col]))
        m[col], m[pivot] = m[pivot], m[col]
        for row in range(3):
            if row != col:
                factor = m[row][col] / m[col][col]
                m[row] = [a - factor * b for a, b in zip(m[row], m[col], strict=True)]
    a, b = m[0][3] / m[0][0], m[1][3] / m[1][1]
    return a / 2, b / 2


class TestCropPrivacyZone:
    def test_crops_leading_and_trailing_points_inside_a_zone(self):
        route = [[0.0, 0.0], [0.0001, 0.0001], [1.0, 1.0], [2.0, 2.0], [0.0002, 0.0002], [0.0, 0.0]]
        assert crop_privacy_zone(route, "1") == [[1.0, 1.0], [2.0, 2.0]]

    def test_route_entirely_inside_a_zone_becomes_none(self):
        route = [[0.0, 0.0], [0.0001, 0.0001]]
        assert crop_privacy_zone(route, "1") is None

    def test_route_outside_every_zone_is_untouched(self):
        route = [[50.0, 50.0], [51.0, 51.0]]
        assert crop_privacy_zone(route, "1") == route

    def test_supports_multiple_zones(self):
        route = [[10.0, 10.0], [5.0, 5.0], [4.0, 4.0], [0.0, 0.0]]
        assert crop_privacy_zone(route, "1") == [[5.0, 5.0], [4.0, 4.0]]

    def test_none_or_empty_route_never_needs_config(self, monkeypatch):
        monkeypatch.delenv("PRIVACY_ZONES", raising=False)
        monkeypatch.delenv("PRIVACY_RADIUS_M", raising=False)

        assert crop_privacy_zone(None) is None
        assert crop_privacy_zone([]) == []


class TestWhatAZoneHides:
    def test_no_kept_point_comes_within_the_configured_radius(self):
        # The zone's centre moves by d and its radius grows by d, and every
        # activity hides at least 100 m more, so by the triangle inequality
        # nothing kept is closer than radius + 100 m to the configured centre.
        for i in range(120):
            cropped = crop_privacy_zone(_ray(i * 3), f"activity-{i}")
            assert cropped
            assert min(distance_m(p, _CENTRE) for p in cropped) >= _RADIUS_M + 100

    def test_a_pass_through_the_middle_of_a_route_is_dropped(self):
        west_to_east = [_offset(x, 0) for x in range(-3000, 3001, 10)]

        cropped = crop_privacy_zone(west_to_east, "through")

        assert cropped[0] == west_to_east[0] and cropped[-1] == west_to_east[-1]
        assert min(distance_m(p, _CENTRE) for p in cropped) >= _RADIUS_M + 100

    def test_endpoints_of_different_runs_do_not_sit_on_one_ring(self):
        # Same street out of the door every time: only the per-activity trim
        # can tell the runs apart.
        starts = [distance_m(crop_privacy_zone(_ray(0), f"run-{i}")[0], _CENTRE) for i in range(50)]

        assert max(starts) - min(starts) > 120

    def test_a_circle_fitted_to_the_endpoints_misses_the_protected_point(self):
        # The attack a fixed-radius crop falls to: every start is just outside
        # the zone, so the centre of the circle through them is the zone
        # centre. Here it lands on the moved centre instead.
        starts = [crop_privacy_zone(_ray(bearing), f"run-{bearing}")[0] for bearing in range(0, 360, 12)]

        cx, cy = _fit_circle([_to_metres(p) for p in starts])

        assert math.hypot(cx, cy) > 50

    def test_the_same_activity_always_crops_the_same_way(self):
        route = _ray(45)
        once = crop_privacy_zone(route, "123")

        assert crop_privacy_zone(route, "123") == once
        assert crop_privacy_zone(once, "123") == once

    def test_without_an_activity_id_the_largest_trim_applies(self):
        without = crop_privacy_zone(_ray(0))

        assert all(len(without) <= len(crop_privacy_zone(_ray(0), f"run-{i}")) for i in range(30))

    def test_the_salt_moves_the_zone_without_uncovering_it(self, monkeypatch):
        monkeypatch.setenv("PRIVACY_SALT", "one")
        first = crop_privacy_zone(_ray(90), "x")
        monkeypatch.setenv("PRIVACY_SALT", "two")
        second = crop_privacy_zone(_ray(90), "x")

        assert first != second
        assert min(distance_m(p, _CENTRE) for p in first + second) >= _RADIUS_M + 100

    def test_reformatting_the_secret_does_not_move_the_zones(self, monkeypatch):
        monkeypatch.setenv("PRIVACY_ZONES", "[[0,0],[10,10]]")
        compact = crop_privacy_zone(_ray(200), "x")
        monkeypatch.setenv("PRIVACY_ZONES", " [ [0.0, 0.00], [10.0, 10] ] ")
        spaced = crop_privacy_zone(_ray(200), "x")

        assert compact == spaced


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
