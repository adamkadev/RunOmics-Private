import json
import math

import verify_privacy_zone

# Metres per degree on the sphere privacy.py measures with, so offsets
# built here come back as exactly the distances they were built from.
_M_PER_DEG = 2 * math.pi * 6_371_000 / 360

# conftest.py configures a fictional zone at (0, 0) with a 500 m radius.


def _point(east_m: float) -> list[float]:
    return [east_m / _M_PER_DEG, 0.0]


def _write_workspace(root, activities):
    activities_dir = root / "activities"
    activities_dir.mkdir(parents=True)
    (activities_dir / "index.json").write_text(json.dumps({"months": ["2026-01"]}))
    (activities_dir / "2026-01.json").write_text(json.dumps({"activities": activities}))
    return root


def test_passes_when_every_point_is_outside_the_configured_radius(tmp_path, capsys):
    root = _write_workspace(tmp_path, [{"id": "1", "route": [_point(900), _point(1500)]}])

    assert verify_privacy_zone.main(root) == 0
    out = capsys.readouterr().out
    assert "OK" in out and "closest: 900 m" in out


def test_fails_on_a_point_inside_the_zone_even_in_the_middle_of_a_route(tmp_path, capsys):
    # Both ends are far outside, so a check of the endpoints alone - or asking
    # the cropping function whether its own output is cropped - would pass.
    route = [_point(-3000), _point(-100), _point(3000)]
    root = _write_workspace(tmp_path, [{"id": "leaky", "route": route}, {"id": "fine", "route": None}])

    assert verify_privacy_zone.main(root) == 1
    out = capsys.readouterr().out
    assert "EXPOSED: 1 of 1" in out and "leaky" in out


def test_reports_distances_never_coordinates(tmp_path, capsys):
    root = _write_workspace(tmp_path, [{"id": "1", "route": [_point(900), [0.0, 1500 / _M_PER_DEG]]}])

    verify_privacy_zone.main(root)

    out = capsys.readouterr().out
    assert "zone 1: 2 endpoints" in out
    assert not any(str(round(c, 4)) in out for c in (900 / _M_PER_DEG, 1500 / _M_PER_DEG) if not math.isclose(c, 0))


def test_refuses_to_guess_without_a_configuration(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("PRIVACY_ZONES", raising=False)
    root = _write_workspace(tmp_path, [{"id": "1", "route": [_point(900), _point(1500)]}])

    assert verify_privacy_zone.main(root) == 2
    assert "Cannot verify" in capsys.readouterr().out


def test_an_empty_workspace_has_nothing_to_verify(tmp_path):
    assert verify_privacy_zone.main(tmp_path) == 0
