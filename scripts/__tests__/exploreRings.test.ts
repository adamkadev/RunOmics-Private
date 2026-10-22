import type { MultiPolygon, Polygon, Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { pointInGeometry } from '@/domain/explore/geometry'
import { assembleMultipolygon, joinRings, type OsmMember } from '../explore/rings'

const way = (ref: number, role: string, points: Position[]): OsmMember => ({
  type: 'way',
  ref,
  role,
  geometry: points.map(([lon, lat]) => ({ lon: lon!, lat: lat! })),
})

// Corners of a fictional 0.01° square and a hole in it.
const A: Position = [20, 5]
const B: Position = [20.01, 5]
const C: Position = [20.01, 5.01]
const D: Position = [20, 5.01]

describe('joinRings', () => {
  it('joins ways end to end into one closed ring', () => {
    const { rings, open } = joinRings([[A, B, C], [C, D, A]])
    expect(open).toBe(0)
    expect(rings).toEqual([[A, B, C, D, A]])
  })

  it('reverses a way drawn the other way, whatever the order', () => {
    const { rings, open } = joinRings([[D, A], [B, C], [A, B], [D, C]])
    expect(open).toBe(0)
    expect(rings).toHaveLength(1)
    const ring = rings[0]!
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
    expect(new Set(ring.map(String))).toEqual(new Set([A, B, C, D].map(String)))
  })

  it('grows from the other end when the first way starts mid-chain', () => {
    const { rings, open } = joinRings([[B, C], [A, B], [C, D, A]])
    expect(open).toBe(0)
    expect(rings[0]).toHaveLength(5)
  })

  it('keeps a way that is already closed, and drops one that never closes', () => {
    const { rings, open } = joinRings([[A, B, C, A], [D, [20.02, 5.02]]])
    expect(rings).toEqual([[A, B, C, A]])
    expect(open).toBe(1)
  })
})

describe('assembleMultipolygon', () => {
  const hole: Position[] = [[20.004, 5.004], [20.006, 5.004], [20.006, 5.006], [20.004, 5.006], [20.004, 5.004]]

  it('puts an inner ring in the outer that holds it', () => {
    const { geometry, open } = assembleMultipolygon([
      way(1, 'outer', [A, B, C]),
      way(2, 'outer', [A, D, C]),
      way(3, 'inner', hole.slice(0, 3)),
      way(4, 'inner', hole.slice(2)),
    ])
    expect(open).toBe(0)
    const polygon = geometry as Polygon
    expect(polygon.type).toBe('Polygon')
    expect(polygon.coordinates).toHaveLength(2)
    expect(pointInGeometry(20.005, 5.005, polygon)).toBe(false)
    expect(pointInGeometry(20.002, 5.002, polygon)).toBe(true)
  })

  it('makes a multipolygon of separate outers, an empty role counting as outer', () => {
    const far: Position[] = [[20.05, 5], [20.06, 5], [20.06, 5.01], [20.05, 5]]
    const { geometry } = assembleMultipolygon([way(1, 'outer', [A, B, C, D, A]), way(2, '', far), { type: 'node', ref: 9, role: 'label' }])
    expect((geometry as MultiPolygon).type).toBe('MultiPolygon')
    expect((geometry as MultiPolygon).coordinates).toHaveLength(2)
  })

  it('is null when no outer ring closes', () => {
    expect(assembleMultipolygon([way(1, 'outer', [A, B, C])]).geometry).toBeNull()
  })
})
