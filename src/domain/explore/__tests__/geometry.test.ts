import { describe, it, expect } from 'vitest'
import type { MultiPolygon, Polygon } from 'geojson'
import { geometryBBox, inBBox, pointInGeometry } from '../geometry'

const square = (x0: number, y0: number, x1: number, y1: number) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
]

describe('pointInGeometry', () => {
  const withHole: Polygon = { type: 'Polygon', coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)] }

  it('finds a point inside a polygon and not one outside', () => {
    expect(pointInGeometry(2, 2, withHole)).toBe(true)
    expect(pointInGeometry(12, 2, withHole)).toBe(false)
    expect(pointInGeometry(-1, 5, withHole)).toBe(false)
  })

  it('leaves out the holes', () => {
    expect(pointInGeometry(5, 5, withHole)).toBe(false)
    expect(pointInGeometry(3.9, 5, withHole)).toBe(true)
  })

  it('checks every polygon of a multipolygon, holes included', () => {
    const multi: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [[square(0, 0, 1, 1)], [square(5, 5, 8, 8), square(6, 6, 7, 7)]],
    }

    expect(pointInGeometry(0.5, 0.5, multi)).toBe(true)
    expect(pointInGeometry(5.5, 5.5, multi)).toBe(true)
    expect(pointInGeometry(6.5, 6.5, multi)).toBe(false)
    expect(pointInGeometry(3, 3, multi)).toBe(false)
  })

  it('gives a point on a shared edge to exactly one of two neighbours', () => {
    const left: Polygon = { type: 'Polygon', coordinates: [square(0, 0, 1, 1)] }
    const right: Polygon = { type: 'Polygon', coordinates: [square(1, 0, 2, 1)] }
    const below: Polygon = { type: 'Polygon', coordinates: [square(0, -1, 1, 0)] }

    for (const lat of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const owners = [left, right].filter((g) => pointInGeometry(1, lat, g))
      expect(owners).toHaveLength(1)
    }
    for (const lon of [0.1, 0.5, 0.9]) {
      const owners = [left, below].filter((g) => pointInGeometry(lon, 0, g))
      expect(owners).toHaveLength(1)
    }
  })

  it('is the same whichever way round a ring is wound', () => {
    const reversed: Polygon = { type: 'Polygon', coordinates: [square(0, 0, 10, 10).reverse()] }

    expect(pointInGeometry(2, 2, reversed)).toBe(true)
    expect(pointInGeometry(11, 2, reversed)).toBe(false)
  })
})

describe('geometryBBox', () => {
  it('bounds the outer rings of every polygon', () => {
    const multi: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [[square(-2, 1, 0, 3)], [square(5, -4, 8, 0), square(6, -3, 7, -2)]],
    }

    expect(geometryBBox(multi)).toEqual([-2, -4, 8, 3])
  })

  it('bounds a single polygon', () => {
    expect(geometryBBox({ type: 'Polygon', coordinates: [square(1, 2, 3, 4)] })).toEqual([1, 2, 3, 4])
  })
})

describe('inBBox', () => {
  it('includes the edges', () => {
    expect(inBBox(0, 0, [0, 0, 1, 1])).toBe(true)
    expect(inBBox(1, 1, [0, 0, 1, 1])).toBe(true)
    expect(inBBox(1.0001, 0.5, [0, 0, 1, 1])).toBe(false)
  })
})
