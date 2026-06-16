from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from garmin_fit_sdk import Decoder, Stream

_SEMICIRCLE_TO_DEG = 180.0 / 2**31
_MAX_ROUTE_POINTS = 300
_EFFORT_TARGETS_M = {
    "1k": 1000.0,
    "5k": 5000.0,
    "10k": 10000.0,
    "half": 21097.5,
    "marathon": 42195.0,
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
    pace_samples: list[float] = field(default_factory=list)
    vo2max_garmin: float | None = None

    @property
    def has_data(self) -> bool:
        return bool(self.route or self.duration_seconds or self.distance_m)


def parse_fit(content: bytes) -> ParsedFit:
    try:
        stream = Stream.from_byte_array(bytearray(content))
        messages, errors = Decoder(stream).read()
    except Exception:
        return ParsedFit()
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

    result = ParsedFit(
        route=_decimate(raw_coords, max_points=_MAX_ROUTE_POINTS),
        heart_rates=heart_rates,
        elevation_samples=elevation_samples,
        elevation_gain_m=round(record_ascent, 1),
        is_race=bool(messages.get("310")),
        best_efforts=_best_efforts(dist_samples, time_samples),
        pace_samples=_pace_samples(dist_samples, time_samples),
        vo2max_garmin=_extract_vo2max(messages),
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

        result.start_time_local = _local_start_time(session, activities)

    return result


def _local_start_time(session: dict, activities: list[dict]) -> datetime | None:
    start = session.get("start_time")
    if not isinstance(start, datetime):
        return None

    for act in activities:
        ts = act.get("timestamp")
        local_ts = act.get("local_timestamp")
        if isinstance(ts, datetime) and isinstance(local_ts, datetime):
            offset = local_ts.replace(tzinfo=None) - ts.replace(tzinfo=None)
            if abs(offset) <= timedelta(hours=14):
                return start.replace(tzinfo=None) + offset

    return None


def _extract_vo2max(messages: dict) -> float | None:
    """Extract Garmin VO2max from FIT message 140, field 7. Formula: raw * 3.5 / 65536."""
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
            if 20.0 <= value <= 90.0:  # sanity check: plausible VO2max range
                return value
    return None


def _pace_samples(dists: list[float], times: list[float]) -> list[float]:
    """Smoothed pace in sec/km using a 30-second backward rolling window."""
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
            pace = dt / dd * 1000.0  # sec/km
            if 90.0 <= pace <= 1200.0:  # 1:30–20:00 /km
                raw[i] = round(pace, 1)
    # Forward-fill
    last: float | None = None
    out: list[float] = []
    for v in raw:
        if v is not None:
            last = v
        out.append(last if last is not None else 0.0)
    # Backward-fill leading zeros with first valid value
    first_valid = next((v for v in out if v > 0.0), None)
    if first_valid is not None:
        for i in range(len(out)):
            if out[i] == 0.0:
                out[i] = first_valid
            else:
                break
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


def _decimate(coords: list[list[float]], max_points: int) -> list[list[float]]:
    if len(coords) <= max_points:
        return coords
    step = len(coords) // max_points
    return coords[::step][:max_points]
