import { PACE_ROUTE_STOPS } from '@/lib/colors'
import { rgbTriplet } from '@/lib/palette'

/** A route has no pace of its own: an even 5:00/km, the ramp's tempo end. */
export const DEFAULT_ROUTE_PACE = 300

/**
 * The pace under a point `ratio` (0 to 1) along the route, read off the
 * pace stream by the same share of its length, linearly between samples.
 */
export function paceAtFraction(paceSamples: readonly number[] | null | undefined, ratio: number): number {
  if (!paceSamples || paceSamples.length < 2) return DEFAULT_ROUTE_PACE
  const at = Math.min(Math.max(ratio, 0), 1) * (paceSamples.length - 1)
  const low = Math.floor(at)
  const high = Math.min(Math.ceil(at), paceSamples.length - 1)
  const t = at - low
  return (paceSamples[low] ?? DEFAULT_ROUTE_PACE) * (1 - t) + (paceSamples[high] ?? DEFAULT_ROUTE_PACE) * t
}

const STOPS = PACE_ROUTE_STOPS.map(([pace, color]) => [pace, rgbTriplet(color)] as const)

/**
 * The route colour at a pace, interpolated in RGB between PACE_ROUTE_STOPS
 * and clamped at both ends - what MapLibre's `interpolate` paints on the
 * Activity map, for a canvas that has no expression engine.
 */
export function paceRouteColor(pace: number): string {
  const first = STOPS[0]!
  const last = STOPS[STOPS.length - 1]!
  if (pace <= first[0]) return `rgb(${first[1].join(',')})`
  if (pace >= last[0]) return `rgb(${last[1].join(',')})`
  const i = STOPS.findIndex(([p]) => p >= pace)
  const [p1, c1] = STOPS[i - 1]!
  const [p2, c2] = STOPS[i]!
  const t = (pace - p1) / (p2 - p1)
  const mix = c1.map((v, k) => Math.round(v + (c2[k]! - v) * t))
  return `rgb(${mix.join(',')})`
}
