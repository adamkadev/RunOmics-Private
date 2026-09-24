import json

import pytest

from garmin import vo2max_norms
from garmin.vo2max_norms import (
    Vo2maxNormsError,
    diff_vo2max_norms,
    normalize_vo2max_norms,
    write_vo2max_norms,
)

_BRACKETS = ("20-29", "30-39", "40-49", "50-59", "60-69", "70-79")


def _bands(superior, excellent, good, fair):
    return [
        {"category": "Superior", "max": "", "min": str(superior)},
        {"category": "Excellent", "max": str(superior), "min": str(excellent)},
        {"category": "Good", "max": str(excellent), "min": str(good)},
        {"category": "Fair", "max": str(good), "min": str(fair)},
        {"category": "Poor", "max": str(fair), "min": ""},
    ]


def _raw_payload():
    return {
        sex: {bracket: _bands(55.4, 51.1, 45.4, 41.7) for bracket in _BRACKETS}
        for sex in ("MALE", "FEMALE")
    }


def test_normalize_takes_each_band_min_as_its_threshold():
    norms = normalize_vo2max_norms(_raw_payload())

    assert norms["male"]["20-29"] == {
        "superior": 55.4,
        "excellent": 51.1,
        "good": 45.4,
        "fair": 41.7,
    }
    assert set(norms) == {"male", "female"}
    assert set(norms["female"]) == set(_BRACKETS)


def test_normalize_rejects_a_missing_bracket():
    raw = _raw_payload()
    del raw["MALE"]["40-49"]

    with pytest.raises(Vo2maxNormsError, match="40-49"):
        normalize_vo2max_norms(raw)


def test_normalize_rejects_a_blank_threshold():
    raw = _raw_payload()
    raw["FEMALE"]["30-39"][0]["min"] = ""

    with pytest.raises(Vo2maxNormsError, match="Superior"):
        normalize_vo2max_norms(raw)


def test_write_reports_no_change_when_values_match(tmp_path, monkeypatch, capsys):
    out = tmp_path / "vo2max_norms.json"
    monkeypatch.setattr(vo2max_norms, "_OUT_PATH", out)
    norms = normalize_vo2max_norms(_raw_payload())

    assert write_vo2max_norms(norms) is True
    assert write_vo2max_norms(norms) is False
    assert "unchanged" in capsys.readouterr().out


def test_write_prints_a_diff_when_garmin_moves_an_anchor(tmp_path, monkeypatch, capsys):
    out = tmp_path / "vo2max_norms.json"
    monkeypatch.setattr(vo2max_norms, "_OUT_PATH", out)
    write_vo2max_norms(normalize_vo2max_norms(_raw_payload()))
    capsys.readouterr()

    raw = _raw_payload()
    raw["MALE"]["20-29"][0]["min"] = "56.0"
    assert write_vo2max_norms(normalize_vo2max_norms(raw)) is True

    output = capsys.readouterr().out
    assert "CHANGED" in output
    assert "male 20-29 superior: 55.4 → 56.0" in output
    assert json.loads(out.read_text())["male"]["20-29"]["superior"] == 56.0


def test_write_keeps_the_committed_file_when_the_fetch_failed(tmp_path, monkeypatch):
    out = tmp_path / "vo2max_norms.json"
    monkeypatch.setattr(vo2max_norms, "_OUT_PATH", out)
    write_vo2max_norms(normalize_vo2max_norms(_raw_payload()))
    before = out.read_text()

    assert write_vo2max_norms(None) is False
    assert out.read_text() == before


def test_an_unreadable_file_is_rewritten_and_reported(tmp_path, monkeypatch, capsys):
    out = tmp_path / "vo2max_norms.json"
    out.write_text('{"male": {')
    monkeypatch.setattr(vo2max_norms, "_OUT_PATH", out)

    assert write_vo2max_norms(normalize_vo2max_norms(_raw_payload())) is True

    assert json.loads(out.read_text())["male"]["20-29"]["superior"] == 55.4
    assert f"{out} could not be read" in capsys.readouterr().out


def test_diff_lists_only_the_thresholds_that_moved():
    before = normalize_vo2max_norms(_raw_payload())
    after = normalize_vo2max_norms(_raw_payload())
    after["female"]["70-79"]["fair"] = 26.5

    assert diff_vo2max_norms(before, after) == ["female 70-79 fair: 41.7 → 26.5"]
