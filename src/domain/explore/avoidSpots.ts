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
}

/** [lon, lat, radius in metres], as a route request carries a spot. */
export type AvoidCircle = [number, number, number]

/** About a street's width either side of a fallen tree or a flooded bend, so the way round stays open. */
export const AVOID_SPOT_RADIUS_M = 80

/** A request carries the nearest 20; past 100 stored, marking stops before the list outgrows the panel. */
export const AVOID_LIMITS = { perRequest: 20, stored: 100, minRadiusM: 20, maxRadiusM: 250 } as const

/** A start or via inside a polygon leaves ORS no routable point there, which fails every loop of the batch. */
const CLEAR_OF_STOPS_M = 50

const METRES_PER_DEGREE = 111_320
const SIDES = 8

export function isAvoidCircle(value: unknown): value is AvoidCircle {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((v) => typeof v === 'number' && Number.isFinite(v))) return false
  const [lon, lat, radiusM] = value as number[]
  return Math.abs(lon!) <= 180 && Math.abs(lat!) <= 90 && radiusM! >= AVOID_LIMITS.minRadiusM && radiusM! <= AVOID_LIMITS.maxRadiusM
}

/** The spots a loop of `distanceM` from `start` could reach, nearest first. */
export function spotsInReach(spots: readonly AvoidSpot[], start: readonly [number, number], distanceM: number): AvoidCircle[] {
  const reachM = distanceM / 2
  return spots
    .map((spot) => ({ spot, m: distanceKm(start[0], start[1], spot.lon, spot.lat) * 1000 }))
    .filter(({ spot, m }) => m - spot.radiusM <= reachM)
    .sort((a, b) => a.m - b.m)
    .slice(0, AVOID_LIMITS.perRequest)
    .map(({ spot }): AvoidCircle => [spot.lon, spot.lat, spot.radiusM])
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
  const kept = circles.filter(
    ([lon, lat, radiusM]) => !stops.some(([sLon, sLat]) => distanceKm(lon, lat, sLon, sLat) * 1000 < radiusM + CLEAR_OF_STOPS_M),
  )
  return kept.length > 0 ? { type: 'MultiPolygon', coordinates: kept.map((circle) => [avoidRing(circle)]) } : null
}
