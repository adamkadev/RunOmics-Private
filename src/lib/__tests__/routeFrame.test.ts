import { describe, it, expect } from 'vitest'
import { percentileBounds } from '../routeFrame'

describe('percentileBounds (v4.17)', () => {
  it('frames the 4th to 96th percentile of every point, not the extremes', () => {
    // 101 points, 0 to 100 on both axes: the frame is 4 to 96.
    const track: [number, number][] = Array.from({ length: 101 }, (_, i) => [i, i])
    expect(percentileBounds([track])).toEqual({ minLon: 4, maxLon: 96, minLat: 4, maxLat: 96 })
  })

  it('pools the points of every run and trims each axis on its own', () => {
    const lons: [number, number][] = Array.from({ length: 51 }, (_, i) => [i, 0])
    const lats: [number, number][] = Array.from({ length: 50 }, (_, i) => [0, i])
    const frame = percentileBounds([lons, lats])!
    expect(frame.maxLon).toBeLessThan(50)
    expect(frame.maxLat).toBeLessThan(49)
  })

  it('keeps one far run from zooming the map out', () => {
    const home: [number, number][] = Array.from({ length: 200 }, (_, i) => [7.75 + (i % 20) * 0.001, 48.58 + Math.floor(i / 20) * 0.001])
    const far: [number, number][] = [[8.2, 48.9], [8.21, 48.91]]
    const frame = percentileBounds([home, far])!
    expect(frame.maxLon).toBeLessThan(7.8)
    expect(frame.maxLat).toBeLessThan(48.6)
  })

  it('is null with no point at all', () => {
    expect(percentileBounds([])).toBeNull()
    expect(percentileBounds([[]])).toBeNull()
  })
})
