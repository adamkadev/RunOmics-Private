import type { Polygon, Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { pointInGeometry } from '@/domain/explore/geometry'
import { projection, projectX, projectY, unproject } from '@/domain/explore/grid'
import { douglasPeucker, geometryAreaM2, ringSelfIntersects, round6, signedArea, simplifyGeometry, simplifyRing, type XY } from '../explore/simplify'

// A fictional place, like the contract fixtures: nothing here is anyone's street.
const p = projection({ origin: [20, 5], cellM: 150 })
const at = (x: number, y: number): Position => unproject(p, x, y)
const metres = (ring: readonly Position[]): XY[] => ring.map(([lon, lat]) => [projectX(p, lon!), projectY(p, lat!)])

function distanceToPolyline([px, py]: XY, line: readonly XY[]): number {
  let best = Infinity
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1]!
    const [bx, by] = line[i]!
    const dx = bx - ax
    const dy = by - ay
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy))
  }
  return best
}

describe('douglasPeucker', () => {
  it('keeps both ends and drops a bump within the tolerance', () => {
    expect(douglasPeucker([[0, 0], [50, 4], [100, 0]], 5)).toEqual([[0, 0], [100, 0]])
    expect(douglasPeucker([[0, 0], [50, 6], [100, 0]], 5)).toEqual([[0, 0], [50, 6], [100, 0]])
  })

  it('leaves every dropped point within the tolerance of what is kept', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16_807) % 2_147_483_647) / 2_147_483_647)
    const line: XY[] = Array.from({ length: 400 }, (_, i) => [i * 3, Math.sin(i / 25) * 40 + random() * 8])
    const kept = douglasPeucker(line, 5)

    expect(kept[0]).toEqual(line[0])
    expect(kept[kept.length - 1]).toEqual(line[line.length - 1])
    expect(kept.length).toBeLessThan(line.length / 4)
    for (const point of line) expect(distanceToPolyline(point, kept)).toBeLessThanOrEqual(5 + 1e-9)
  })
})

describe('simplifyRing', () => {
  // A 400 m square drawn clockwise with a vertex every 20 m, each nudged by up to 1 m.
  const side = (from: XY, to: XY): XY[] => {
    const vertical = from[0] === to[0]
    return Array.from({ length: 20 }, (_, i) => {
      const jitter = i === 0 ? 0 : i % 2 ? 0.8 : -0.8
      return [from[0] + ((to[0] - from[0]) * i) / 20 + (vertical ? jitter : 0), from[1] + ((to[1] - from[1]) * i) / 20 + (vertical ? 0 : jitter)]
    })
  }
  const clockwise: XY[] = [...side([0, 0], [0, 400]), ...side([0, 400], [400, 400]), ...side([400, 400], [400, 0]), ...side([400, 0], [0, 0])]
  const ring = [...clockwise, clockwise[0]!].map(([x, y]) => at(x, y))

  it('reduces a jittered square to its corners, closed and anticlockwise', () => {
    const simplified = simplifyRing(ring, p, 5, true)!
    expect(simplified).toHaveLength(5)
    expect(simplified[0]).toEqual(simplified[4])
    expect(signedArea(metres(simplified))).toBeGreaterThan(0)
    for (const point of metres(ring)) expect(distanceToPolyline(point, metres(simplified))).toBeLessThanOrEqual(5.1)
  })

  it('winds a hole clockwise', () => {
    expect(signedArea(metres(simplifyRing(ring, p, 5, false)!))).toBeLessThan(0)
  })

  it('rounds to 6 decimals', () => {
    for (const [lon, lat] of simplifyRing(ring, p, 5, true)!) {
      expect(Math.round(lon! * 1e6) / 1e6).toBe(lon)
      expect(Math.round(lat! * 1e6) / 1e6).toBe(lat)
    }
  })

  // A slot 3 m wide with a needle of land 0.3–0.6 m wide reaching into it.
  // Plain Douglas-Peucker at 5 m drops the slot's far corner (100, 0), which
  // is 3 m off the chord, and the chord from (0, 0) to (100, 3) then runs
  // through the needle: a bow-tie, though no point moved more than 5 m.
  const needle: XY[] = [[0, 0], [100, 0], [100, 3], [40, 3], [40, 50], [-50, 50], [-50, 1.8], [90, 1.5], [-60, 1.2], [-60, -10]]

  it('never lets a ring cross itself: a crossed one is simplified again, tighter', () => {
    expect(ringSelfIntersects(needle)).toBe(false)
    const simplified = simplifyRing([...needle, needle[0]!].map(([x, y]) => at(x, y)), p, 5, true)!

    expect(ringSelfIntersects(metres(simplified).slice(0, -1))).toBe(false)
    // The slot's corner is back, and the needle is still there.
    const corners = metres(simplified).map(([x, y]) => [Math.round(x), Math.round(y)].join(','))
    expect(corners).toContain('100,0')
    expect(corners).toContain('90,1')
    for (const point of needle) expect(distanceToPolyline(point, metres(simplified))).toBeLessThanOrEqual(5.1)
  })

  it('still simplifies a ring that never crosses at the asked tolerance', () => {
    expect(simplifyRing(ring, p, 5, true)).toHaveLength(5)
  })

  it('gives up on a ring with less area than a tolerance square', () => {
    expect(simplifyRing([at(0, 0), at(3, 0), at(3, 3), at(0, 3), at(0, 0)], p, 5, false)).toBeNull()
    expect(simplifyRing([at(0, 0), at(30, 0), at(0, 0)], p, 5, true)).toBeNull()
  })
})

describe('ringSelfIntersects', () => {
  it('finds a bow-tie and a ring touching itself, and passes a simple ring', () => {
    expect(ringSelfIntersects([[0, 0], [10, 10], [10, 0], [0, 10]])).toBe(true)
    // A vertex resting on a non-neighbouring edge is not a simple ring either.
    expect(ringSelfIntersects([[0, 0], [10, 0], [10, 10], [5, 0], [0, 10]])).toBe(true)
    expect(ringSelfIntersects([[0, 0], [10, 0], [10, 10], [5, 2], [0, 10]])).toBe(false)
    expect(ringSelfIntersects([[0, 0], [10, 0], [0, 10]])).toBe(false)
  })
})

describe('simplifyGeometry', () => {
  const square = (x: number, y: number, size: number): Position[] => [at(x, y), at(x + size, y), at(x + size, y + size), at(x, y + size), at(x, y)]

  it('keeps a real hole, drops a degenerate one, and stays a valid polygon', () => {
    const geometry: Polygon = { type: 'Polygon', coordinates: [square(0, 0, 1000), square(200, 200, 100), square(600, 600, 2)] }
    const simplified = simplifyGeometry(geometry, p, 5) as Polygon

    expect(simplified.type).toBe('Polygon')
    expect(simplified.coordinates).toHaveLength(2)
    for (const ring of simplified.coordinates) expect(ring.length).toBeGreaterThanOrEqual(4)
    const [hx, hy] = unproject(p, 250, 250)
    expect(pointInGeometry(hx, hy, simplified)).toBe(false)
    // Squares have nothing to simplify: what moves is only the 6-decimal
    // rounding, up to 0.06 m per corner, which over 4.4 km of outline is
    // tens of m² (59 here), never the 10 000 m² of the hole.
    const rounded: Polygon = { type: 'Polygon', coordinates: geometry.coordinates.slice(0, 2).map((ring) => ring.map(([lon, lat]) => [round6(lon!), round6(lat!)])) }
    expect(geometryAreaM2(simplified, p)).toBeCloseTo(geometryAreaM2(rounded, p), 2)
    expect(Math.abs(geometryAreaM2(simplified, p) - (1000 * 1000 - 100 * 100))).toBeLessThan(4400 * 0.06)
  })

  it('drops an island smaller than the tolerance and keeps the main shape', () => {
    const simplified = simplifyGeometry({ type: 'MultiPolygon', coordinates: [[square(0, 0, 500)], [[at(900, 900), at(901, 900), at(901, 901), at(900, 900)]]] }, p, 5)
    expect(simplified.type).toBe('Polygon')
  })
})
