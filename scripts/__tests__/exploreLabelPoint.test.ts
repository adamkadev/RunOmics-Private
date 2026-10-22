import type { MultiPolygon, Polygon, Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { pointInGeometry } from '@/domain/explore/geometry'
import { projection, projectX, projectY, unproject } from '@/domain/explore/grid'
import { labelPoint, polylabel, signedDistance } from '../explore/labelPoint'
import type { XY } from '../explore/simplify'

const p = projection({ origin: [20, 5], cellM: 150 })
const at = (x: number, y: number): Position => unproject(p, x, y)
const ring = (points: XY[]): Position[] => [...points, points[0]!].map(([x, y]) => at(x, y))
const depth = ([lon, lat]: [number, number], rings: XY[][]) => signedDistance(projectX(p, lon), projectY(p, lat), rings)

describe('labelPoint', () => {
  it('lands inside a U whose centroid is in the notch', () => {
    // 1 km wide, 1 km tall, with a 600 m wide notch cut 800 m deep from the top.
    const u: XY[] = [[0, 0], [1000, 0], [1000, 1000], [800, 1000], [800, 200], [200, 200], [200, 1000], [0, 1000]]
    const geometry: Polygon = { type: 'Polygon', coordinates: [ring(u)] }
    const label = labelPoint(geometry, p)

    const [cx, cy] = unproject(p, 500, 500)
    expect(pointInGeometry(cx, cy, geometry)).toBe(false)
    expect(pointInGeometry(label[0], label[1], geometry)).toBe(true)
    // The legs and the base are 200 m thick, so the best point is ~100 m from any edge.
    expect(depth(label, [u])).toBeGreaterThan(95)
  })

  it('stays out of the hole of a ring-shaped unit', () => {
    const outer: XY[] = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]]
    const hole: XY[] = [[300, 300], [300, 700], [700, 700], [700, 300]]
    const geometry: Polygon = { type: 'Polygon', coordinates: [ring(outer), ring(hole)] }
    const label = labelPoint(geometry, p)

    expect(pointInGeometry(label[0], label[1], geometry)).toBe(true)
    expect(depth(label, [outer, hole])).toBeGreaterThan(140)
  })

  it('picks the polygon with the deepest interior and passes the extra shapes', () => {
    const small: XY[] = [[0, 0], [100, 0], [100, 100], [0, 100]]
    const big: XY[] = [[500, 0], [1500, 0], [1500, 1000], [500, 1000]]
    const geometry: MultiPolygon = { type: 'MultiPolygon', coordinates: [[ring(small)], [ring(big)]] }
    const label = labelPoint(geometry, p, [{ type: 'Polygon', coordinates: [ring(big)] }])

    const [x, y] = [projectX(p, label[0]), projectY(p, label[1])]
    expect(x).toBeCloseTo(1000, -1)
    expect(y).toBeCloseTo(500, -1)
  })

  it('rounds to 6 decimals', () => {
    const label = labelPoint({ type: 'Polygon', coordinates: [ring([[0, 0], [700, 0], [700, 300], [0, 300]])] }, p)
    for (const value of label) expect(Math.round(value * 1e6) / 1e6).toBe(value)
  })
})

describe('polylabel', () => {
  it('finds the centre of a rectangle to the metre', () => {
    const best = polylabel([[[0, 0], [400, 0], [400, 200], [0, 200], [0, 0]]], 1)
    expect(best.d).toBeGreaterThan(99)
    expect(best.y).toBeCloseTo(100, 0)
  })
})
