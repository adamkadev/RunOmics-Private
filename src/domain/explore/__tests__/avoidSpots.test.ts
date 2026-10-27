import { describe, expect, it } from 'vitest'
import {
  AVOID_LIMITS,
  avoidPolygons,
  avoidRing,
  clearOfSpots,
  closestApproachM,
  expiryFor,
  isAvoidCircle,
  isExpired,
  nearAvoidCircle,
  spotsInReach,
  type AvoidCircle,
  type AvoidSpot,
} from '../avoidSpots'

const M = 1 / 111_320
const spot = (id: string, eastM: number, radiusM = 80): AvoidSpot => ({
  id,
  lon: -150 + eastM * M,
  lat: 0,
  radiusM,
  createdAt: '2026-10-26',
  reason: null,
  expiresOn: null,
})
const east = (m: number): [number, number] => [-150 + m * M, 0]
const north = (m: number): [number, number] => [-150, m * M]

describe('isAvoidCircle', () => {
  it('takes a spot on the earth within the radius limits', () => {
    expect(isAvoidCircle([-150, 0, 80])).toBe(true)
    expect(isAvoidCircle([-150, 0, AVOID_LIMITS.minRadiusM - 1])).toBe(false)
    expect(isAvoidCircle([-150, 0, AVOID_LIMITS.maxRadiusM + 1])).toBe(false)
    expect(isAvoidCircle([181, 0, 80])).toBe(false)
    expect(isAvoidCircle([-150, 0])).toBe(false)
    expect(isAvoidCircle(['-150', 0, 80])).toBe(false)
  })
})

describe('spotsInReach', () => {
  it('keeps the spots half the loop away or nearer, nearest first', () => {
    const spots = [spot('far', 6000), spot('near', 500), spot('edge', 4060), spot('mid', 2000)]
    expect(spotsInReach(spots, east(0), 8000).map(([lon]) => Math.round((lon + 150) / M))).toEqual([500, 2000, 4060])
  })

  it('sends no more than a request carries', () => {
    const spots = Array.from({ length: 30 }, (_, k) => spot(`s${k}`, 100 * k))
    expect(spotsInReach(spots, east(0), 10_000)).toHaveLength(AVOID_LIMITS.perRequest)
  })
})

describe('nearAvoidCircle', () => {
  it('is within the radius and 50 m past it', () => {
    const circle: AvoidCircle = [...east(0), 80]
    expect(nearAvoidCircle(east(125), [circle])).toBe(true)
    expect(nearAvoidCircle(east(135), [circle])).toBe(false)
    expect(nearAvoidCircle(east(0), [])).toBe(false)
  })
})

describe('closestApproachM', () => {
  it('measures to the nearest point of a segment, not only its ends', () => {
    expect(closestApproachM([north(-500), north(500)], east(100))).toBeCloseTo(100, 0)
    expect(closestApproachM([north(200), north(500)], east(0))).toBeCloseTo(200, 0)
    expect(closestApproachM([east(300)], east(0))).toBeCloseTo(300, 0)
  })
})

describe('clearOfSpots', () => {
  const line = [east(-1000), east(1000)]

  it('refuses a loop through a spot and takes one past its edge', () => {
    expect(clearOfSpots(line, [[...north(50), 80]], [east(-1000)])).toBe(false)
    expect(clearOfSpots(line, [[...north(100), 80]], [east(-1000)])).toBe(true)
  })

  it('leaves out a spot by a stop, which ORS was not asked to avoid', () => {
    expect(clearOfSpots(line, [[...east(-1000), 80]], [east(-1000)])).toBe(true)
    expect(clearOfSpots(line, [[...east(500), 80]], [east(-1000), east(560)])).toBe(true)
  })
})

describe('avoidPolygons', () => {
  it('draws a closed octagon around each circle clear of the stops', () => {
    const polygons = avoidPolygons([[...east(1000), 80], [...east(0), 80]], [east(50)])
    expect(polygons?.coordinates).toHaveLength(1)
    const ring = polygons!.coordinates[0]![0]!
    expect(ring).toHaveLength(9)
    expect(ring[8]).toEqual(ring[0])
    for (const [lon, lat] of ring) expect(closestApproachM([[lon!, lat!]], east(1000))).toBeGreaterThanOrEqual(80)
  })

  it('is null when every circle is by a stop', () => {
    expect(avoidPolygons([[...east(0), 80]], [east(0)])).toBeNull()
    expect(avoidRing([...east(0), 80])).toHaveLength(9)
  })
})

describe('expiry', () => {
  it('lasts about three weeks for mud and six for a closure; an unsafe spot stays', () => {
    expect(expiryFor('mud', '2026-10-26')).toBe('2026-11-16')
    expect(expiryFor('blocked', '2026-10-26')).toBe('2026-12-07')
    expect(expiryFor('unsafe', '2026-10-26')).toBeNull()
    expect(expiryFor(null, '2026-10-26')).toBeNull()
  })

  it('is over on its day', () => {
    expect(isExpired({ expiresOn: '2026-11-16' }, '2026-11-15')).toBe(false)
    expect(isExpired({ expiresOn: '2026-11-16' }, '2026-11-16')).toBe(true)
    expect(isExpired({ expiresOn: null }, '2099-01-01')).toBe(false)
  })
})
