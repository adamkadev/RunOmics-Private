"""Duration bests and grade-adjusted distance, from a run's full-resolution records."""

from __future__ import annotations

import math
from collections.abc import Sequence

DURATIONS_S = (30, 60, 120, 180, 300, 600, 1200, 1800, 3600, 5400, 7200)

# 2:05/km: no step of these athletes' runs is that fast, so a faster one is a GPS jump.
_MAX_SPEED_MS = 8.0

# A 60 m slope: on a barometer's altitude, the climb it adds up to matches the watch's own total ascent.
_GRADE_HALF_SPAN_M = 30.0
_GRADE_MIN_SPAN_M = 20.0
# Steeper is hiking, where Minetti's running data thin out and a barometer step reads as a cliff.
MAX_GRADE = 0.25
_MIN_ALTITUDE_SHARE = 0.5
# GPS-only altitude (a Forerunner 55) jitters metres around its 100 m mean, barometric under 0.6 m; the convex cost
# curve would turn that jitter into speed.
_NOISE_HALF_SPAN_M = 50.0
_MAX_ALTITUDE_NOISE_M = 1.0


def jump_capped(dists: Sequence[float], times: Sequence[float]) -> tuple[list[float], list[float]]:
    """Distance from the start with each GPS jump capped at _MAX_SPEED_MS, and the clock made non-decreasing."""
    n = len(dists)
    # A record logged inside a timer pause can sit later on the moving clock than the one after the restart.
    clock = list(times)
    for i in range(1, n):
        clock[i] = max(clock[i], clock[i - 1])
    capped = [0.0] * n
    for i in range(1, n):
        step = max(0.0, dists[i] - dists[i - 1])
        capped[i] = capped[i - 1] + min(step, _MAX_SPEED_MS * (clock[i] - clock[i - 1]))
    return capped, clock


def duration_bests(dists: Sequence[float], times: Sequence[float]) -> dict[str, float]:
    """Most metres covered in each of DURATIONS_S, keyed by its seconds; `times` is the moving clock."""
    if len(dists) < 2:
        return {}
    capped, clock = jump_capped(dists, times)
    out: dict[str, float] = {}
    for window in DURATIONS_S:
        best = _best_distance(capped, clock, window)
        if best is not None:
            out[str(window)] = round(best, 1)
    return out


def _interpolate(xs: Sequence[float], ys: Sequence[float], j: int, x: float) -> float:
    """y at x, inside the step that ends at sample j."""
    x0, x1 = xs[j - 1], xs[j]
    if x1 <= x0:
        return ys[j]
    return ys[j - 1] + (ys[j] - ys[j - 1]) * (x - x0) / (x1 - x0)


def _best_distance(dists: Sequence[float], times: Sequence[float], window: float) -> float | None:
    """Exact on a piecewise-linear track: the best window starts or ends on a sample, so both anchorings are tried."""
    n = len(dists)
    if times[-1] - times[0] < window:
        return None
    best = 0.0
    j = 1
    for i in range(n):
        end = times[i] + window
        if end > times[-1]:
            break
        while times[j] < end:
            j += 1
        best = max(best, _interpolate(times, dists, j, end) - dists[i])
    i = 1
    for j in range(n):
        start = times[j] - window
        if start < times[0]:
            continue
        while times[i] < start:
            i += 1
        best = max(best, dists[j] - _interpolate(times, dists, i, start))
    return best


def minetti_cost(grade: float) -> float:
    """Energy cost of running in J/kg/m at a gradient (rise over run), Minetti et al. 2002, J Appl Physiol 93:1039."""
    i = max(-MAX_GRADE, min(MAX_GRADE, grade))
    return ((((155.4 * i - 30.4) * i - 43.3) * i + 46.3) * i + 19.5) * i + 3.6


_FLAT_COST = minetti_cost(0.0)


def _filled(alts: Sequence[float | None]) -> list[float] | None:
    known = [i for i, a in enumerate(alts) if a is not None]
    if not known or len(known) < _MIN_ALTITUDE_SHARE * len(alts):
        return None
    value = [float(a) if a is not None else 0.0 for a in alts]
    out = [value[known[0]]] * len(alts)
    for a, b in zip(known, known[1:], strict=False):
        for i in range(a, b + 1):
            out[i] = value[a] + (value[b] - value[a]) * (i - a) / (b - a)
    for i in range(known[-1], len(alts)):
        out[i] = value[known[-1]]
    return out


def altitude_noise(dists: Sequence[float], alts: Sequence[float]) -> float:
    """Root mean square of the altitude about its own mean over the 100 m around each sample."""
    n = len(dists)
    prefix = [0.0]
    for a in alts:
        prefix.append(prefix[-1] + a)
    total = 0.0
    lo = hi = 0
    for i in range(n):
        while dists[lo] < dists[i] - _NOISE_HALF_SPAN_M:
            lo += 1
        while hi < n - 1 and dists[hi + 1] <= dists[i] + _NOISE_HALF_SPAN_M:
            hi += 1
        total += (alts[i] - (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1)) ** 2
    return math.sqrt(total / n) if n else 0.0


def grades(dists: Sequence[float], alts: Sequence[float]) -> list[float]:
    """Rise over run at each sample, across the 60 m around it, clamped to ±MAX_GRADE."""
    n = len(dists)
    out = [0.0] * n
    if n < 2:
        return out
    lo = hi = 1
    for i in range(n):
        back = max(dists[0], dists[i] - _GRADE_HALF_SPAN_M)
        ahead = min(dists[-1], dists[i] + _GRADE_HALF_SPAN_M)
        if ahead - back < _GRADE_MIN_SPAN_M:
            continue
        while lo < n - 1 and dists[lo] < back:
            lo += 1
        while hi < n - 1 and dists[hi] < ahead:
            hi += 1
        rise = _interpolate(dists, alts, hi, ahead) - _interpolate(dists, alts, lo, back)
        out[i] = max(-MAX_GRADE, min(MAX_GRADE, rise / (ahead - back)))
    return out


def flat_equivalent(dists: Sequence[float], alts: Sequence[float | None]) -> list[float] | None:
    """Cumulative metres of flat running costing what each stretch cost on its gradient; None without a usable altitude."""
    if len(dists) < 2:
        return None
    filled = _filled(alts)
    if filled is None or altitude_noise(dists, filled) > _MAX_ALTITUDE_NOISE_M:
        return None
    slope = grades(dists, filled)
    out = [0.0] * len(dists)
    for i in range(1, len(dists)):
        step = max(0.0, dists[i] - dists[i - 1])
        out[i] = out[i - 1] + step * minetti_cost((slope[i - 1] + slope[i]) / 2) / _FLAT_COST
    return out
