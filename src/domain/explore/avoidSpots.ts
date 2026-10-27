import type { MultiPolygon, Position } from 'geojson'
import { distanceKm } from '@/lib/math'

export const AVOID_REASONS = ['blocked', 'mud', 'unsafe'] as const
export type AvoidReason = (typeof AVOID_REASONS)[number]

export interface AvoidSpot {
  id: string
  lon: number
  lat: number
  radiusM: number
  /** 'YYYY-MM-DD' it was marked. */
  createdAt: string
  reason: AvoidReason | null
  /** 'YYYY-MM-DD' from which loops no longer go round it; null keeps it until removed. */
  expiresOn: string | null
}

/** [lon, lat, radius in metres], as a route request carries a spot. */
export type AvoidCircle = [number, number, number]

/** About a street's width either side of a fallen tree or a flooded bend, so the way round stays open. */
export const AVOID_SPOT_RADIUS_M = 80

/** A request carries the nearest 20; past 100 stored, marking stops before the list outgrows the panel. */
export const AVOID_LIMITS = { perRequest: 20, stored: 100, minRadiusM: 20, maxRadiusM: 250 } as const

/** A tree across a path, about a street's width either side, a whole flooded field. */
export const AVOID_RADII_M = [40, 80, 150] as const

/** Mud dries in about three weeks and a works closure lasts about six; an unsafe corner stays unsafe. */
export const AVOID_EXPIRY_DAYS: Record<AvoidReason, number | null> = { mud: 21, blocked: 42, unsafe: null }

/** A start or via inside a polygon leaves ORS no routable point there, which fails every loop of the batch. */
export const CLEAR_OF_STOPS_M = 50

const DAY_MS = 86_400_000
/** The octagon's edges touch the circle, and ORS rounds its line to about a metre. */
const EDGE_SLACK_M = 2

const METRES_PER_DEGREE = 111_320
const SIDES = 8

export function isAvoidCircle(value: unknown): value is AvoidCircle {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((v) => typeof v === 'number' && Number.isFinite(v))) return false
  const [lon, lat, radiusM] = value as number[]
  return Math.abs(lon!) <= 180 && Math.abs(lat!) <= 90 && radiusM! >= AVOID_LIMITS.minRadiusM && radiusM! <= AVOID_LIMITS.maxRadiusM
}

export function expiryFor(reason: AvoidReason | null, today: string): string | null {
  const days = reason ? AVOID_EXPIRY_DAYS[reason] : null
  return days === null ? null : new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export const isExpired = (spot: Pick<AvoidSpot, 'expiresOn'>, today: string) => spot.expiresOn !== null && spot.expiresOn <= today

export const circleOf = (spot: Pick<AvoidSpot, 'lon' | 'lat' | 'radiusM'>): AvoidCircle => [spot.lon, spot.lat, spot.radiusM]

/** Whether a start or via there would sit inside a spot's polygon, or too close to it for ORS to route from. */
export function nearAvoidCircle([lon, lat]: readonly [number, number], circles: readonly AvoidCircle[]): boolean {
  return circles.some(([cLon, cLat, radiusM]) => distanceKm(lon, lat, cLon, cLat) * 1000 < radiusM + CLEAR_OF_STOPS_M)
}

/** Metres from the line to the point, on a plane about the point: exact enough within a loop's few kilometres. */
export function closestApproachM(line: readonly (readonly number[])[], [lon, lat]: readonly [number, number]): number {
  const kx = METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180)
  const xy = (p: readonly number[]): [number, number] => [(p[0]! - lon) * kx, (p[1]! - lat) * METRES_PER_DEGREE]
  let best = Infinity
  for (let k = 0; k < line.length; k++) {
    const [ax, ay] = xy(line[k]!)
    const [bx, by] = k + 1 < line.length ? xy(line[k + 1]!) : [ax, ay]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return best
}

/**
 * Whether the loop keeps out of every circle. A circle by one of the loop's stops is left out: ORS was not asked to
 * avoid it (`avoidPolygons`), and the runner chose that start.
 */
export function clearOfSpots(
  line: readonly (readonly number[])[],
  circles: readonly AvoidCircle[],
  stops: readonly (readonly [number, number])[],
): boolean {
  return circles.every((circle) => {
    if (stops.some((stop) => nearAvoidCircle(stop, [circle]))) return true
    return closestApproachM(line, [circle[0], circle[1]]) >= circle[2] - EDGE_SLACK_M
  })
}

/** The spots a loop of `distanceM` from `start` could reach, nearest first. */
export function spotsInReach(spots: readonly AvoidSpot[], start: readonly [number, number], distanceM: number): AvoidCircle[] {
  const reachM = distanceM / 2
  return spots
    .map((spot) => ({ spot, m: distanceKm(start[0], start[1], spot.lon, spot.lat) * 1000 }))
    .filter(({ spot, m }) => m - spot.radiusM <= reachM)
    .sort((a, b) => a.m - b.m)
    .slice(0, AVOID_LIMITS.perRequest)
    .map(({ spot }) => circleOf(spot))
}

/** An octagon around the circle, so the whole circle is avoided; closed and counter-clockwise, as GeoJSON wants. */
export function avoidRing([lon, lat, radiusM]: AvoidCircle): Position[] {
  const r = radiusM / Math.cos(Math.PI / SIDES)
  const dLat = r / METRES_PER_DEGREE
  const dLon = r / (METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180))
  const ring: Position[] = []
  for (let k = 0; k < SIDES; k++) {
    const a = (2 * Math.PI * (k + 0.5)) / SIDES
    ring.push([+(lon + dLon * Math.cos(a)).toFixed(6), +(lat + dLat * Math.sin(a)).toFixed(6)])
  }
  ring.push(ring[0]!)
  return ring
}

export function avoidPolygons(circles: readonly AvoidCircle[], stops: readonly (readonly [number, number])[]): MultiPolygon | null {
  const kept = circles.filter((circle) => !stops.some((stop) => nearAvoidCircle(stop, [circle])))
  return kept.length > 0 ? { type: 'MultiPolygon', coordinates: kept.map((circle) => [avoidRing(circle)]) } : null
}
