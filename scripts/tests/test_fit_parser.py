"""Tests for the pure-logic core of the FIT parser.

These functions compute the best efforts that feed the Records/PR pages and
the route/pace data shown on every activity - a silent regression here
corrupts the whole dashboard, so they are pinned by tests even though the
FIT decoding itself (garmin_fit_sdk) is exercised only via the corrupt-input
path (building valid FIT binaries in a test isn't worth the machinery).
"""

from datetime import datetime, timezone

from processing.fit_parser import (
    ParsedFit,
    _best_efforts,
    _decimate,
    _extract_splits,
    _extract_vo2max,
    _local_start_time,
    _pace_samples,
    parse_fit,
)


def constant_speed_samples(total_m: float, pace_sec_per_km: float, step_m: float = 10.0):
    """Distance/time sample arrays for a perfectly steady run."""
    dists, times = [], []
    d = 0.0
    while d <= total_m:
        dists.append(d)
        times.append(d / 1000.0 * pace_sec_per_km)
        d += step_m
    return dists, times


class TestBestEfforts:
    def test_constant_speed_run_yields_pace_times_distance(self):
        # 6 km at exactly 5:00/km.
        dists, times = constant_speed_samples(6000.0, 300.0)
        efforts = _best_efforts(dists, times)

        assert efforts["1k"] == 300.0
        assert efforts["5k"] == 1500.0
        # 1 mile = 1609.34 m at 0.3 s/m.
        assert efforts["1mile"] == round(1609.34 * 0.3, 1)

    def test_distances_longer_than_the_run_are_absent(self):
        dists, times = constant_speed_samples(6000.0, 300.0)
        efforts = _best_efforts(dists, times)

        assert "10k" not in efforts
        assert "half" not in efforts
        assert "marathon" not in efforts

    def test_negative_split_finds_the_fast_segment(self):
        # 3 km at 6:00/km then 3 km at 4:00/km - the best 1k must come from
        # the fast half, not the overall average.
        dists, times = [], []
        d, t = 0.0, 0.0
        while d < 3000.0:
            dists.append(d)
            times.append(t)
            d += 10.0
            t += 3.6  # 360 s/km
        while d <= 6000.0:
            dists.append(d)
            times.append(t)
            d += 10.0
            t += 2.4  # 240 s/km
        efforts = _best_efforts(dists, times)

        assert efforts["1k"] == 240.0

    def test_empty_or_single_sample_returns_nothing(self):
        assert _best_efforts([], []) == {}
        assert _best_efforts([0.0], [0.0]) == {}


class TestPaceSamples:
    def test_constant_speed_pace_is_flat(self):
        dists, times = constant_speed_samples(2000.0, 300.0)
        paces = _pace_samples(dists, times)

        assert len(paces) == len(dists)
        # Every sample (after the fill of the leading window) is 300 s/km.
        assert all(p == 300.0 for p in paces)

    def test_implausible_paces_are_filtered_and_forward_filled(self):
        # Standing still for 60 s mid-run: dd stays ~0, so those samples are
        # invalid and must inherit the last valid pace instead of spiking.
        dists = [0.0, 100.0, 200.0, 200.5, 201.0, 301.0, 401.0]
        times = [0.0, 30.0, 60.0, 90.0, 120.0, 150.0, 180.0]
        paces = _pace_samples(dists, times)

        assert len(paces) == len(dists)
        assert all(90.0 <= p <= 1200.0 for p in paces)

    def test_too_few_samples(self):
        assert _pace_samples([0.0], [0.0]) == []


class TestDecimate:
    def test_straight_line_collapses_to_endpoints(self):
        # 500 collinear points: RDP should drop everything in between.
        coords = [[20.50 + i * 0.0001, 10.11] for i in range(500)]
        out = _decimate(coords, max_points=100)

        assert out[0] == coords[0]
        assert out[-1] == coords[-1]
        assert len(out) <= 5

    def test_corners_are_kept(self):
        # A right angle: the corner point must survive simplification.
        leg1 = [[20.50 + i * 0.0001, 10.11] for i in range(100)]
        corner = [20.51, 10.11]
        leg2 = [[20.51, 10.11 + i * 0.0001] for i in range(1, 100)]
        coords = leg1 + [corner] + leg2
        out = _decimate(coords, max_points=100)

        assert corner in out

    def test_respects_max_points(self):
        # Jittered path that RDP can't simplify below max_points at the base
        # epsilon - the epsilon escalation loop must still enforce the cap.
        coords = [[20.50 + i * 0.0001, 10.11 + (0.0002 if i % 2 else -0.0002)] for i in range(2000)]
        out = _decimate(coords, max_points=150)

        assert len(out) <= 150

    def test_short_routes_untouched(self):
        coords = [[20.50, 10.11], [20.51, 10.12]]
        assert _decimate(coords, max_points=100) == coords


class TestExtractSplits:
    def _messages(self):
        t0 = datetime(2026, 7, 1, 10, 0, 0)
        return {
            "split_mesgs": [
                # Non-interval split: ignored.
                {"split_type": "rwd_run", "total_timer_time": 600.0},
                {
                    "split_type": "interval_active",
                    "total_timer_time": 240.0,
                    "total_distance": 1000.0,
                    "avg_speed": 4.17,
                    15: 178,  # undocumented avg HR field
                    "start_time": t0,
                    "end_time": datetime(2026, 7, 1, 10, 4, 0),
                },
            ],
            "lap_mesgs": [
                # Inside the interval window.
                {
                    "start_time": datetime(2026, 7, 1, 10, 1, 0),
                    "total_distance": 400.0,
                    "total_timer_time": 96.0,
                    "avg_heart_rate": 180,
                },
                # Outside the window: excluded.
                {
                    "start_time": datetime(2026, 7, 1, 11, 0, 0),
                    "total_distance": 400.0,
                    "total_timer_time": 96.0,
                },
                # No start_time: excluded.
                {"total_distance": 200.0, "total_timer_time": 60.0},
            ],
        }

    def test_interval_split_with_its_laps(self):
        splits = _extract_splits(self._messages())

        assert len(splits) == 1
        s = splits[0]
        assert s.type == "interval_active"
        assert s.duration_sec == 240
        assert s.avg_hr == 178
        assert len(s.laps) == 1
        assert s.laps[0].avg_hr == 180
        assert s.laps[0].avg_speed_ms == 400.0 / 96.0

    def test_no_interval_splits_returns_empty(self):
        assert _extract_splits({"split_mesgs": [{"split_type": "rwd_run", "total_timer_time": 60.0}]}) == []
        assert _extract_splits({}) == []


class TestExtractVo2max:
    def test_reads_field_7_with_garmin_scaling(self):
        raw = int(52.0 * 65536 / 3.5)
        assert _extract_vo2max({"max_met_data_mesgs": [{7: raw}]}) == 52.0

    def test_out_of_range_values_rejected(self):
        raw = int(150.0 * 65536 / 3.5)  # implausible VO2max
        assert _extract_vo2max({"max_met_data_mesgs": [{7: raw}]}) is None

    def test_missing_message_returns_none(self):
        assert _extract_vo2max({}) is None


class TestLocalStartTime:
    def test_applies_activity_utc_offset(self):
        start = datetime(2026, 7, 1, 8, 0, 0, tzinfo=timezone.utc)
        session = {"start_time": start}
        activities = [{
            "timestamp": datetime(2026, 7, 1, 9, 0, 0, tzinfo=timezone.utc),
            "local_timestamp": datetime(2026, 7, 1, 11, 0, 0),
        }]
        assert _local_start_time(session, activities) == datetime(2026, 7, 1, 10, 0, 0)

    def test_raw_fit_epoch_local_timestamp(self):
        start = datetime(2026, 7, 28, 19, 30, 0, tzinfo=timezone.utc)
        session = {"start_time": start}
        activities = [{
            "timestamp": datetime(2026, 7, 28, 19, 55, 56, tzinfo=timezone.utc),
            "local_timestamp": 1154210156,
        }]
        assert _local_start_time(session, activities) == datetime(2026, 7, 28, 21, 30, 0)

    def test_absurd_offset_is_ignored(self):
        session = {"start_time": datetime(2026, 7, 1, 8, 0, 0)}
        activities = [{
            "timestamp": datetime(2026, 7, 1, 9, 0, 0),
            "local_timestamp": datetime(2026, 7, 3, 9, 0, 0),  # +48h
        }]
        assert _local_start_time(session, activities) is None

    def test_no_start_time(self):
        assert _local_start_time({}, []) is None


class TestParseFitRobustness:
    def test_corrupt_bytes_yield_empty_result_not_a_crash(self):
        parsed = parse_fit(b"definitely not a FIT file")
        assert isinstance(parsed, ParsedFit)
        assert not parsed.has_data

    def test_empty_bytes(self):
        assert not parse_fit(b"").has_data
