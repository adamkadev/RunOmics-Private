from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from garmin_fit_sdk import Decoder, Stream

from processing.pace_profile import duration_bests, flat_equivalent

_SEMICIRCLE_TO_DEG = 180.0 / 2**31
_MAX_ROUTE_POINTS = 2000
_FIT_EPOCH = datetime(1989, 12, 31)
_EFFORT_TARGETS_M = {
    "1k": 1000.0,
    "1mile": 1609.34,
    "5k": 5000.0,
    "10k": 10000.0,
    "half": 21097.5,
    "marathon": 42195.0,
}


_INTERVAL_SPLIT_TYPES = {
    "interval_warmup",
    "interval_active",
    "interval_rest",
    "interval_recovery",
    "interval_cooldown",
}

_LAP_SPLIT_TYPE = "lap"
_MIN_LAP_SPLITS = 2


@dataclass
class SplitLap:
    duration_sec: int
    distance_m: float
    avg_speed_ms: float
    avg_hr: int | None

    def to_dict(self) -> dict:
        return {
            "durationSec": self.duration_sec,
            "distanceM": round(self.distance_m, 1),
            "avgSpeedMs": round(self.avg_speed_ms, 4),
            "avgHr": self.avg_hr,
        }


@dataclass
class ActivitySplit:
    type: str
    duration_sec: int
    distance_m: float
    avg_speed_ms: float
    avg_hr: int | None
    laps: list[SplitLap] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "durationSec": self.duration_sec,
            "distanceM": round(self.distance_m, 1),
            "avgSpeedMs": round(self.avg_speed_ms, 4),
            "avgHr": self.avg_hr,
            "laps": [lap.to_dict() for lap in self.laps],
        }


@dataclass
class ParsedFit:
    route: list[list[float]] = field(default_factory=list)
    heart_rates: list[int] = field(default_factory=list)
    elevation_samples: list[float] = field(default_factory=list)
    elevation_gain_m: float = 0.0
    start_time_local: datetime | None = None
    duration_seconds: int = 0
    distance_m: float = 0.0
    avg_heart_rate: int | None = None
    max_heart_rate: int | None = None
    rpe: int | None = None
    aer_training_effect: float | None = None
    ana_training_effect: float | None = None
    is_race: bool = False
    primary_benefit: int | None = None
    calories: int | None = None
    cadence_spm: float | None = None
    ground_contact_ms: float | None = None
    vertical_oscillation_mm: float | None = None
    vertical_ratio_pct: float | None = None
    stride_length_m: float | None = None
    best_efforts: dict[str, float] = field(default_factory=dict)
    duration_bests: dict[str, float] = field(default_factory=dict)
    pace_samples: list[float] = field(default_factory=list)
    gap_factor: float | None = None
    gap_samples: list[float] = field(default_factory=list)
    vo2max_garmin: float | None = None
    avg_temperature: int | None = None
    cadence_samples: list[float] = field(default_factory=list)
    splits: list[ActivitySplit] = field(default_factory=list)

    @property
    def has_data(self) -> bool:
        return bool(self.route or self.duration_seconds or self.distance_m)


def parse_fit(content: bytes) -> ParsedFit:
    """The SDK mostly hands its errors back rather than raising them; they are printed, as an empty result looks like no data."""
    try:
        stream = Stream.from_byte_array(bytearray(content))
        messages, errors = Decoder(stream).read()
    except Exception as exc:
        print(f"  Warning: FIT decoder failed ({type(exc).__name__}: {exc})")
        return ParsedFit()
    if errors:
        print(f"  Warning: FIT decoder reported {len(errors)} error(s), first: {errors[0]}")
    if not messages:
        return ParsedFit()

    records = messages.get("record_mesgs", [])
    sessions = messages.get("session_mesgs", [])
    activities = messages.get("activity_mesgs", [])

    raw_coords: list[list[float]] = []
    heart_rates: list[int] = []
    elevation_samples: list[float] = []
    dist_samples: list[float] = []
    time_samples: list[float] = []
    cadence_samples: list[float] = []
    prev_alt: float | None = None
    record_ascent = 0.0

    for rec in records:
        lat = rec.get("position_lat")
        lng = rec.get("position_long")
        if lat is not None and lng is not None:
            raw_coords.append(
                [round(lng * _SEMICIRCLE_TO_DEG, 6), round(lat * _SEMICIRCLE_TO_DEG, 6)]
            )

        hr = rec.get("heart_rate")
        if hr:
            heart_rates.append(int(hr))

        alt = rec.get("enhanced_altitude")
        if alt is None:
            alt = rec.get("altitude")
        if alt is not None:
            elevation_samples.append(round(float(alt), 1))
            if prev_alt is not None and alt > prev_alt:
                record_ascent += alt - prev_alt
            prev_alt = alt

        dist = rec.get("distance")
        ts = rec.get("timestamp")
        if dist is not None and isinstance(ts, datetime):
            dist_samples.append(float(dist))
            time_samples.append(ts.timestamp())

        cad = rec.get("cadence")
        if cad is not None:
            frac = rec.get("fractional_cadence") or 0
            cadence_samples.append(round((float(cad) + float(frac)) * 2, 1))

    result = ParsedFit(
        route=_decimate(raw_coords, max_points=_MAX_ROUTE_POINTS),
        heart_rates=heart_rates,
        elevation_samples=elevation_samples,
        elevation_gain_m=round(record_ascent, 1),
        is_race=bool(messages.get("310")),
        # On the moving clock: a best effort can't include a stop the run's own (timer) duration leaves out.
        best_efforts=_best_efforts(
            dist_samples,
            _moving_clock(dist_samples, time_samples, _timer_pauses(messages.get("event_mesgs", []))),
        ),
        pace_samples=_pace_samples(dist_samples, time_samples),
        vo2max_garmin=_extract_vo2max(messages),
        cadence_samples=cadence_samples,
    )

    if sessions:
        session = sessions[0]

        duration = session.get("total_timer_time") or session.get("total_elapsed_time")
        if duration:
            result.duration_seconds = int(round(float(duration)))

        distance = session.get("total_distance")
        if distance:
            result.distance_m = float(distance)

        avg_hr = session.get("avg_heart_rate")
        if avg_hr:
            result.avg_heart_rate = int(avg_hr)
        max_hr = session.get("max_heart_rate")
        if max_hr:
            result.max_heart_rate = int(max_hr)

        aer_te = session.get("total_training_effect")
        if aer_te is not None:
            result.aer_training_effect = float(aer_te)
        ana_te = session.get("total_anaerobic_training_effect")
        if ana_te is not None:
            result.ana_training_effect = float(ana_te)

        ascent = session.get("total_ascent")
        if ascent is not None:
            result.elevation_gain_m = round(float(ascent), 1)

        rpe = session.get("workout_rpe")
        if rpe is not None:
            rpe = int(rpe)
            result.rpe = max(1, min(10, rpe // 10))

        benefit = session.get(188)
        if benefit is not None:
            result.primary_benefit = int(benefit)

        calories = session.get("total_calories")
        if calories:
            result.calories = int(calories)

        cadence = session.get("avg_running_cadence") or session.get("avg_cadence")
        if cadence:
            frac = session.get("avg_fractional_cadence") or 0
            result.cadence_spm = round((float(cadence) + float(frac)) * 2, 1)

        stance = session.get("avg_stance_time")
        if stance:
            result.ground_contact_ms = round(float(stance), 1)

        osc = session.get("avg_vertical_oscillation")
        if osc:
            result.vertical_oscillation_mm = round(float(osc), 1)

        ratio = session.get("avg_vertical_ratio")
        if ratio:
            result.vertical_ratio_pct = round(float(ratio), 2)

        step = session.get("avg_step_length")
        if step:
            result.stride_length_m = round(float(step) / 1000, 2)

        avg_temp = session.get("avg_temperature")
        if avg_temp is not None:
            result.avg_temperature = round(float(avg_temp))

        result.start_time_local = _local_start_time(session, activities)

    result.splits = _extract_splits(messages)
    _add_pace_profile(result, records, messages.get("event_mesgs", []))

    return result


def _extract_splits(messages: dict) -> list[ActivitySplit]:
    raw_splits = messages.get("split_mesgs", [])
    raw_laps = messages.get("lap_mesgs", [])

    parsed_laps = _parse_laps(raw_laps)

    interval_splits = []
    for s in raw_splits:
        split_type = s.get("split_type", "")
        if split_type not in _INTERVAL_SPLIT_TYPES:
            continue
        duration = s.get("total_timer_time") or s.get("total_elapsed_time")
        if not duration:
            continue
        interval_splits.append((split_type, s, float(duration)))

    if not interval_splits:
        return _lap_splits(parsed_laps)

    result = []
    for split_type, s, duration in interval_splits:
        distance = float(s.get("total_distance") or 0)
        speed = float(s.get("avg_speed") or 0)
        # Field 15 is avg_heart_rate, undocumented in garmin_fit_sdk for split_mesgs.
        raw_hr = s.get(15) or s.get("avg_heart_rate")
        avg_hr = int(raw_hr) if raw_hr else None

        split_start = s.get("start_time")
        split_end = s.get("end_time")

        laps: list[SplitLap] = []
        if isinstance(split_start, datetime) and isinstance(split_end, datetime):
            for lap in parsed_laps:
                if split_start <= lap["start"] <= split_end:
                    laps.append(SplitLap(
                        duration_sec=lap["duration_sec"],
                        distance_m=lap["distance_m"],
                        avg_speed_ms=lap["avg_speed_ms"],
                        avg_hr=lap["avg_hr"],
                    ))

        result.append(ActivitySplit(
            type=split_type,
            duration_sec=int(round(duration)),
            distance_m=distance,
            avg_speed_ms=speed,
            avg_hr=avg_hr,
            laps=laps,
        ))
    return result


def _parse_laps(raw_laps: list[dict]) -> list[dict]:
    parsed_laps = []
    for lap in raw_laps:
        start = lap.get("start_time")
        if not isinstance(start, datetime):
            continue
        dist = float(lap.get("total_distance") or 0)
        timer = float(lap.get("total_timer_time") or lap.get("total_elapsed_time") or 0)
        if timer <= 0:
            continue
        parsed_laps.append({
            "start": start,
            "duration_sec": int(round(timer)),
            "distance_m": dist,
            "avg_speed_ms": dist / timer,
            "avg_hr": int(lap["avg_heart_rate"]) if lap.get("avg_heart_rate") else None,
        })
    return parsed_laps


def _lap_splits(parsed_laps: list[dict]) -> list[ActivitySplit]:
    """A lap covering no ground carries no pace, and a single lap restates the activity total: neither is a split."""
    laps = [lap for lap in parsed_laps if lap["distance_m"] > 0]
    if len(laps) < _MIN_LAP_SPLITS:
        return []

    return [
        ActivitySplit(
            type=_LAP_SPLIT_TYPE,
            duration_sec=lap["duration_sec"],
            distance_m=lap["distance_m"],
            avg_speed_ms=lap["avg_speed_ms"],
            avg_hr=lap["avg_hr"],
            laps=[],
        )
        for lap in laps
    ]


def _naive_datetime(value: object) -> datetime | None:
    """`timestamp` comes back decoded, but `local_timestamp` stays a raw FIT timestamp (seconds since 1989-12-31)."""
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, (int, float)):
        return _FIT_EPOCH + timedelta(seconds=int(value))
    return None


def _local_start_time(session: dict, activities: list[dict]) -> datetime | None:
    start = session.get("start_time")
    if not isinstance(start, datetime):
        return None

    for act in activities:
        ts = _naive_datetime(act.get("timestamp"))
        local_ts = _naive_datetime(act.get("local_timestamp"))
        if ts is not None and local_ts is not None:
            offset = local_ts - ts
            if abs(offset) <= timedelta(hours=14):
                return start.replace(tzinfo=None) + offset

    return None


def _extract_vo2max(messages: dict) -> float | None:
    entries = (
        messages.get("max_met_data_mesgs")
        or messages.get(140)
        or messages.get("140")
        or []
    )
    for entry in entries:
        raw = entry.get(7) or entry.get("7") or entry.get("vo2_max_setting") or entry.get("calibrated_data")
        if raw:
            value = round(int(raw) * 3.5 / 65536, 1)
            if 20.0 <= value <= 90.0:
                return value
    return None


def _pace_samples(dists: list[float], times: list[float]) -> list[float]:
    """Pace in sec/km over a 30-second backward window."""
    n = len(dists)
    if n < 2:
        return []
    raw: list[float | None] = [None] * n
    window_s = 30.0
    for i in range(n):
        j = i
        while j > 0 and times[i] - times[j - 1] <= window_s:
            j -= 1
        dd = dists[i] - dists[j]
        dt = times[i] - times[j]
        if dd > 1.0 and dt > 0.0:
            pace = dt / dd * 1000.0
            if 90.0 <= pace <= 1200.0:  # 1:30–20:00 /km
                raw[i] = round(pace, 1)
    last: float | None = None
    out: list[float] = []
    for v in raw:
        if v is not None:
            last = v
        out.append(last if last is not None else 0.0)
    first_valid = next((v for v in out if v > 0.0), None)
    if first_valid is not None:
        for i in range(len(out)):
            if out[i] == 0.0:
                out[i] = first_valid
            else:
                break
    return out


_STOP_EVENTS = {"stop", "stop_all", "stop_disable", "stop_disable_all"}
# Without timer events, a gap this long covering almost no ground is a stop.
_PAUSE_GAP_S = 10.0
_PAUSE_SPEED_MS = 0.5


def _timer_pauses(events: list[dict]) -> list[tuple[float, float]]:
    """(stop, restart) spans in epoch seconds."""
    pauses: list[tuple[float, float]] = []
    stopped: float | None = None
    timed = [e for e in events if e.get("event") == "timer" and isinstance(e.get("timestamp"), datetime)]
    for event in sorted(timed, key=lambda e: e["timestamp"]):
        ts = event["timestamp"].timestamp()
        kind = event.get("event_type")
        if kind in _STOP_EVENTS and stopped is None:
            stopped = ts
        elif kind == "start" and stopped is not None:
            pauses.append((stopped, ts))
            stopped = None
    return pauses


def _moving_clock(dists: list[float], times: list[float], pauses: list[tuple[float, float]]) -> list[float]:
    out: list[float] = []
    offset = 0.0
    k = 0
    for i, t in enumerate(times):
        if pauses:
            while k < len(pauses) and pauses[k][1] <= t:
                offset += pauses[k][1] - pauses[k][0]
                k += 1
        elif i:
            dt = t - times[i - 1]
            if dt > _PAUSE_GAP_S and (dists[i] - dists[i - 1]) / dt < _PAUSE_SPEED_MS:
                offset += dt
        out.append(t - offset)
    return out


def _best_efforts(dists: list[float], times: list[float]) -> dict[str, float]:
    out: dict[str, float] = {}
    n = len(dists)
    if n < 2:
        return out

    for key, target in _EFFORT_TARGETS_M.items():
        if dists[-1] - dists[0] < target:
            continue
        best: float | None = None
        j = 1
        for i in range(n):
            need = dists[i] + target
            if need > dists[-1]:
                break
            if j <= i:
                j = i + 1
            while j < n and dists[j] < need:
                j += 1
            if j >= n:
                break
            d0, d1 = dists[j - 1], dists[j]
            t_cross = (
                times[j - 1] + (times[j] - times[j - 1]) * (need - d0) / (d1 - d0)
                if d1 > d0
                else times[j]
            )
            elapsed = t_cross - times[i]
            if elapsed > 0 and (best is None or elapsed < best):
                best = elapsed
        if best is not None:
            out[key] = round(best, 1)

    return out


def _add_pace_profile(result: ParsedFit, records: list[dict], events: list[dict]) -> None:
    """Duration bests and grade-adjusted pace, over the same records as pace_samples so the two streams line up."""
    dists: list[float] = []
    times: list[float] = []
    alts: list[float | None] = []
    for rec in records:
        dist = rec.get("distance")
        ts = rec.get("timestamp")
        if dist is not None and isinstance(ts, datetime):
            dists.append(float(dist))
            times.append(ts.timestamp())
            alt = rec.get("enhanced_altitude")
            if alt is None:
                alt = rec.get("altitude")
            alts.append(float(alt) if alt is not None else None)
    result.duration_bests = duration_bests(dists, _moving_clock(dists, times, _timer_pauses(events)))
    flat = flat_equivalent(dists, alts)
    if flat is None or dists[-1] - dists[0] <= 0:
        return
    result.gap_factor = round(flat[-1] / (dists[-1] - dists[0]), 4)
    result.gap_samples = _pace_samples(flat, times)


_ROUTE_EPSILON_M = 0.5
_METERS_PER_DEGREE = 111_320.0


def _project_meters(lon: float, lat: float, lon0: float, lat0: float) -> tuple[float, float]:
    """Equirectangular, accurate enough at a single-run scale."""
    x = (lon - lon0) * math.cos(math.radians(lat0)) * _METERS_PER_DEGREE
    y = (lat - lat0) * _METERS_PER_DEGREE
    return x, y


def _perpendicular_distance(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> float:
    x0, y0 = point
    x1, y1 = start
    x2, y2 = end
    if (x1, y1) == (x2, y2):
        return math.hypot(x0 - x1, y0 - y1)
    num = abs((x2 - x1) * (y0 - y1) - (x0 - x1) * (y2 - y1))
    den = math.hypot(x2 - x1, y2 - y1)
    return num / den


def _rdp_significance(points: list[tuple[float, float]], floor: float) -> list[float]:
    """For each point, the largest epsilon at which Douglas-Peucker keeps it, exact for every epsilon from `floor` up.

    Which point is farthest does not depend on epsilon, so a point survives exactly while its own distance and every
    ancestor's exceed epsilon: one pass answers the simplification for every epsilon at once.
    """
    significance = [0.0] * len(points)
    significance[0] = significance[-1] = math.inf
    stack = [(0, len(points) - 1, math.inf)]
    while stack:
        start_i, end_i, ceiling = stack.pop()
        start, end = points[start_i], points[end_i]
        max_dist = 0.0
        max_i = -1
        for i in range(start_i + 1, end_i):
            dist = _perpendicular_distance(points[i], start, end)
            if dist > max_dist:
                max_dist = dist
                max_i = i
        if max_i != -1 and max_dist > floor:
            kept_until = min(max_dist, ceiling)
            significance[max_i] = kept_until
            stack.append((start_i, max_i, kept_until))
            stack.append((max_i, end_i, kept_until))
    return significance


def _decimate(coords: list[list[float]], max_points: int) -> list[list[float]]:
    """Douglas-Peucker at the smallest epsilon of the ladder 0.5 m, x1.5, x1.5... that brings the route down to max_points."""
    if len(coords) < 3:
        return coords
    if max_points < 2:
        raise ValueError("the first and last points are always kept, so max_points must be at least 2")
    lon0, lat0 = coords[len(coords) // 2]
    points = [_project_meters(lon, lat, lon0, lat0) for lon, lat in coords]
    significance = _rdp_significance(points, floor=_ROUTE_EPSILON_M)

    # kept(epsilon) fits under the cap once epsilon reaches the significance
    # of the first point past it.
    epsilon = _ROUTE_EPSILON_M
    over_cap = sorted(significance, reverse=True)[max_points:]
    if over_cap:
        while epsilon < over_cap[0]:
            epsilon *= 1.5
    return [c for c, s in zip(coords, significance, strict=True) if s > epsilon]
