import type { Polygon } from 'geojson'
import { describe, expect, it } from 'vitest'
import { communeContaining, geometryIntersectsBBox, mostPopulous, roundOutward, unionBBox, type Commune } from '../explore/communes'

const square = (lon: number, lat: number, size: number): Polygon => ({
  type: 'Polygon',
  coordinates: [[[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]]],
})

const commune = (code: string, population: number, geometry: Polygon): Commune => ({ code, name: `Commune ${code}`, population, geometry })

describe('choosing the city', () => {
  const small = commune('99002', 4_000, square(20, 5, 0.01))
  const city = commune('99003', 120_000, square(20.01, 5, 0.05))
  const twin = commune('99001', 120_000, square(19.9, 5, 0.05))

  it('is the most populous commune, the lower INSEE code breaking a tie', () => {
    expect(mostPopulous([small, city])).toBe(city)
    expect(mostPopulous([city, small, twin])).toBe(twin)
    expect(mostPopulous([])).toBeUndefined()
  })

  it('finds the commune a point is in, wherever the city is', () => {
    expect(communeContaining(20.005, 5.005, [city, small])).toBe(small)
    expect(communeContaining(30, 5, [city, small])).toBeUndefined()
  })
})

describe('geometryIntersectsBBox', () => {
  // An L: its envelope is [0, 0, 2, 2], but the square [1, 1, 2, 2] is empty.
  const l: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 0]]] }

  it('is true when a vertex is in the box', () => {
    expect(geometryIntersectsBBox(l, [-0.5, -0.5, 0.5, 0.5])).toBe(true)
  })

  it('is true when the box is inside the shape', () => {
    expect(geometryIntersectsBBox(square(0, 0, 10), [4, 4, 5, 5])).toBe(true)
  })

  it('is true when an edge crosses the box with no vertex in it', () => {
    expect(geometryIntersectsBBox(square(0, 0, 10), [-1, 4, 1, 5])).toBe(true)
  })

  it('is false in the envelope’s empty corner, and far away', () => {
    expect(geometryIntersectsBBox(l, [1.2, 1.2, 1.8, 1.8])).toBe(false)
    expect(geometryIntersectsBBox(l, [5, 5, 6, 6])).toBe(false)
  })
})

describe('bbox helpers', () => {
  it('rounds a box out to whole hundredths of a degree', () => {
    expect(roundOutward([6.12345, 49.08765, 6.20001, 49.13])).toEqual([6.12, 49.08, 6.21, 49.14])
  })

  it('unites boxes', () => {
    expect(unionBBox([[0, 0, 1, 1], [-1, 0.5, 0.5, 2]])).toEqual([-1, 0, 1, 2])
  })
})
