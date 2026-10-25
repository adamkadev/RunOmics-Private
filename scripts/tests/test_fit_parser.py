"""FIT decoding itself is exercised only via the corrupt-input path: building valid FIT binaries isn't worth the machinery."""

import random
from datetime import datetime, timezone

import pytest

from processing import fit_parser
from processing.fit_parser import (
    ParsedFit,
    _best_efforts,
    _moving_clock,
    _timer_pauses,
    _decimate,
    _extract_splits,
    _extract_vo2max,
    _local_start_time,
    _pace_samples,
    _perpendicular_distance,
    _project_meters,
    parse_fit,
)
from processing.pace_profile import duration_bests, flat_equivalent, minetti_cost


def constant_speed_samples(total_m: float, pace_sec_per_km: float, step_m: float = 10.0):
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

    @pytest.mark.parametrize("max_points", [2, 40, 150, 400], ids=lambda m: f"cap {m}")
    @pytest.mark.parametrize("route", ["random walk", "zigzag"])
    def test_keeps_exactly_the_points_the_epsilon_ladder_kept(self, route, max_points):
        # The reference re-runs Douglas-Peucker at 0.5 m, then x1.5 per step until under the cap: every stored route
        # came out of it, so the result must not move.
        coords = _random_walk(400) if route == "random walk" else _zigzag(200)

        assert _decimate(coords, max_points) == _ladder_decimate(coords, max_points)

    def test_a_cap_below_the_two_endpoints_is_refused(self):
        with pytest.raises(ValueError):
            _decimate(_zigzag(10), max_points=1)


def _random_walk(n: int) -> list[list[float]]:
    rng = random.Random(7)
    lon, lat, coords = 20.50, 10.11, []
    for _ in range(n):
        lon += rng.uniform(-0.0002, 0.0003)
        lat += rng.uniform(-0.0002, 0.0003)
        coords.append([round(lon, 6), round(lat, 6)])
    return coords


def _zigzag(n: int) -> list[list[float]]:
    return [[20.50 + i * 0.0001, 10.11 + (0.0002 if i % 2 else -0.0002)] for i in range(n)]


def _ladder_decimate(coords: list[list[float]], max_points: int) -> list[list[float]]:
    lon0, lat0 = coords[len(coords) // 2]
    points = [_project_meters(lon, lat, lon0, lat0) for lon, lat in coords]

    def keep_mask(epsilon: float) -> list[bool]:
        keep = [False] * len(points)
        keep[0] = keep[-1] = True
        stack = [(0, len(points) - 1)]
        while stack:
            start, end = stack.pop()
            best, best_i = 0.0, -1
            for i in range(start + 1, end):
                dist = _perpendicular_distance(points[i], points[start], points[end])
                if dist > best:
                    best, best_i = dist, i
            if best_i != -1 and best > epsilon:
                keep[best_i] = True
                stack += [(start, best_i), (best_i, end)]
        return keep

    epsilon = 0.5
    keep = keep_mask(epsilon)
    while sum(keep) > max_points:
        epsilon *= 1.5
        keep = keep_mask(epsilon)
    return [c for c, k in zip(coords, keep, strict=True) if k]


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

    def test_interval_splits_win_over_plain_laps(self):
        # The same messages also carry laps; a structured workout still reports
        # its interval splits, never the raw laps.
        splits = _extract_splits(self._messages())

        assert [s.type for s in splits] == ["interval_active"]

    def test_no_split_or_lap_data_returns_empty(self):
        assert _extract_splits({"split_mesgs": [{"split_type": "rwd_run", "total_timer_time": 60.0}]}) == []
        assert _extract_splits({}) == []


def lap_mesg(minute, distance_m=1000.0, timer=300.0, hr=None):
    """A FIT lap message as Garmin records one per kilometre on an ordinary run."""
    lap = {
        "start_time": datetime(2026, 7, 1, 10, minute, 0),
        "total_distance": distance_m,
        "total_timer_time": timer,
    }
    if hr is not None:
        lap["avg_heart_rate"] = hr
    return lap


class TestLapFallbackSplits:
    """Ordinary runs and races carry lap_mesgs but no interval split_mesgs -
    those laps are what Garmin itself shows as the run's splits."""

    def test_normal_run_laps_become_splits(self):
        splits = _extract_splits({
            "lap_mesgs": [lap_mesg(0, 1000.0, 300.0, 152), lap_mesg(5, 1000.0, 290.0, 158)],
        })

        assert [s.type for s in splits] == ["lap", "lap"]
        assert [s.duration_sec for s in splits] == [300, 290]
        assert [s.distance_m for s in splits] == [1000.0, 1000.0]
        assert splits[0].avg_speed_ms == 1000.0 / 300.0
        assert [s.avg_hr for s in splits] == [152, 158]
        # A plain lap has no sub-laps of its own.
        assert all(s.laps == [] for s in splits)

    def test_race_laps_become_splits_without_heart_rate(self):
        splits = _extract_splits({
            "lap_mesgs": [lap_mesg(0), lap_mesg(5), lap_mesg(10, 1097.5, 320.0)],
        })

        assert len(splits) == 3
        assert [s.avg_hr for s in splits] == [None, None, None]
        assert splits[2].distance_m == 1097.5

    def test_non_interval_split_mesgs_do_not_block_the_lap_fallback(self):
        splits = _extract_splits({
            "split_mesgs": [{"split_type": "rwd_run", "total_timer_time": 600.0}],
            "lap_mesgs": [lap_mesg(0), lap_mesg(5)],
        })

        assert [s.type for s in splits] == ["lap", "lap"]

    def test_malformed_laps_are_ignored(self):
        splits = _extract_splits({
            "lap_mesgs": [
                lap_mesg(0),
                {"total_distance": 1000.0, "total_timer_time": 300.0},   # no start_time
                lap_mesg(5, 1000.0, 0.0),                                 # zero duration
                lap_mesg(10, 1000.0, None),                               # no duration at all
                lap_mesg(15, 0.0, 300.0),                                 # no distance
                lap_mesg(20),
            ],
        })

        assert len(splits) == 2
        assert [s.duration_sec for s in splits] == [300, 300]

    def test_a_single_lap_is_not_a_split(self):
        # One lap is the activity total restated - nothing to show.
        assert _extract_splits({"lap_mesgs": [lap_mesg(0)]}) == []

    def test_no_usable_laps_yields_no_splits(self):
        assert _extract_splits({"lap_mesgs": [lap_mesg(0, 1000.0, 0.0)]}) == []
        assert _extract_splits({"lap_mesgs": []}) == []


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

    def test_what_the_decoder_rejected_is_reported(self, capsys):
        # The SDK hands its errors back rather than raising.
        parse_fit(b"definitely not a FIT file")

        assert "not a fit file" in capsys.readouterr().out

    def test_a_decoder_crash_is_reported(self, monkeypatch, capsys):
        def crash(_content):
            raise IndexError("list index out of range")

        monkeypatch.setattr(fit_parser.Stream, "from_byte_array", crash)

        assert not parse_fit(b"anything").has_data
        assert "IndexError: list index out of range" in capsys.readouterr().out


class TestMovingClock:
    """Best efforts on the timer, never across a stop."""

    def test_timer_pauses_come_out_of_the_clock(self):
        from datetime import datetime, timezone

        at = lambda s: datetime.fromtimestamp(s, tz=timezone.utc)  # noqa: E731
        events = [
            {"event": "timer", "event_type": "start", "timestamp": at(0)},
            {"event": "timer", "event_type": "stop_all", "timestamp": at(100)},
            {"event": "timer", "event_type": "start", "timestamp": at(460)},
            {"event": "lap", "event_type": "marker", "timestamp": at(200)},
        ]
        pauses = _timer_pauses(events)
        assert pauses == [(100.0, 460.0)]
        assert _moving_clock([0, 300, 300, 600], [0, 100, 460, 560], pauses) == [0, 100, 100, 200]

    def test_a_long_standstill_gap_counts_as_a_pause_without_events(self):
        clock = _moving_clock([0, 300, 305, 605], [0, 100, 400, 500], [])
        assert clock == [0, 100, 100, 200]

    def test_a_best_effort_never_exceeds_the_moving_time(self):
        # 10 km at 3 m/s with a six-minute stop at 5 km.
        dists = [float(d) for d in range(0, 5001, 100)] + [float(d) for d in range(5000, 10_001, 100)]
        times = [d / 3 for d in dists[:51]] + [d / 3 + 360 for d in dists[51:]]
        moving = _moving_clock(dists, times, [])
        effort = _best_efforts(dists, moving)["10k"]
        assert effort <= moving[-1] - moving[0] + 0.1
        assert abs(effort - 10_000 / 3) < 1


class TestDurationBests:
    def test_a_steady_run_covers_its_speed_times_each_duration_it_lasts(self):
        dists, times = constant_speed_samples(6000.0, 300.0)

        bests = duration_bests(dists, times)

        assert bests == {str(s): round(s / 0.3, 1) for s in (30, 60, 120, 180, 300, 600, 1200, 1800)}

    def test_the_best_window_is_the_fastest_stretch_even_between_samples(self):
        dists = [0.0, 1000.0, 1400.0, 2400.0]
        times = [0.0, 360.0, 420.0, 780.0]

        bests = duration_bests(dists, times)

        assert bests["60"] == 400.0
        assert bests["120"] == pytest.approx(400.0 + 60 * 1000 / 360, abs=0.1)

    def test_a_stop_on_the_moving_clock_is_not_slow_running(self):
        dists = [float(d) for d in range(0, 1201, 10)] + [float(d) for d in range(1200, 2401, 10)]
        times = [d / 4 for d in dists[:121]] + [d / 4 + 600 for d in dists[121:]]

        bests = duration_bests(dists, _moving_clock(dists, times, []))

        assert bests["600"] == 2400.0

    def test_a_gps_jump_adds_no_more_than_the_fastest_plausible_step(self):
        dists, times = constant_speed_samples(3000.0, 300.0, step_m=3.0)
        dists = [d + (250.0 if i >= 300 else 0.0) for i, d in enumerate(dists)]

        assert duration_bests(dists, times)["30"] <= 100.0 + 8.0


class TestGradeAdjusted:
    def test_minetti_costs_a_climb_more_and_a_gentle_descent_less_than_the_flat(self):
        assert minetti_cost(0.0) == 3.6
        assert minetti_cost(0.10) == pytest.approx(5.968, abs=1e-3)
        assert minetti_cost(-0.10) == pytest.approx(2.152, abs=1e-3)
        assert minetti_cost(0.6) == minetti_cost(0.25)

    @pytest.mark.parametrize("grade", [0.0, 0.05, -0.05])
    def test_a_constant_grade_scales_the_distance_by_its_cost(self, grade):
        dists = [float(d) for d in range(0, 2001)]
        alts = [100.0 + grade * d for d in dists]

        flat = flat_equivalent(dists, alts)

        assert flat[-1] / dists[-1] == pytest.approx(minetti_cost(grade) / 3.6, rel=1e-3)

    def test_a_jittering_gps_altitude_gives_no_grade_adjusted_pace(self):
        rng = random.Random(3)
        dists = [float(d) for d in range(0, 2001)]
        alts = [100.0 + rng.uniform(-3.0, 3.0) for _ in dists]

        assert flat_equivalent(dists, alts) is None

    def test_a_run_without_altitude_gives_no_grade_adjusted_pace(self):
        assert flat_equivalent([0.0, 10.0, 20.0], [None, None, None]) is None
