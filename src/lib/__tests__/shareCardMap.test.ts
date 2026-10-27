import { describe, expect, it } from 'vitest'
import { ROUTE_INSET, bandFencePoints, projectRoute, routeFencePoints, simplifyRoute, type LngLat } from '@/lib/shareCardMap'

/** The widest end marker the card draws, as a radius: the loop's, at the card's 0.85. */
const MARKER_RADIUS = (11 + 1.5) * 0.85

describe('simplifyRoute', () => {
  it('leaves short routes untouched', () => {
    const route: LngLat[] = [[0, 0], [1, 1], [2, 2]]
    expect(simplifyRoute(route)).toBe(route)
  })

  it('thins long routes but keeps the first and last point', () => {
    const route: LngLat[] = Array.from({ length: 1000 }, (_, i) => [i / 1000, i / 1000])
    const thinned = simplifyRoute(route, 100)
    expect(thinned.length).toBeLessThanOrEqual(101)
    expect(thinned[0]).toEqual(route[0])
    expect(thinned.at(-1)).toEqual(route.at(-1))
  })
})

describe('projectRoute', () => {
  // The share card's map: 300 wide, the middle under a one-line title.
  const W = 300
  const H = 236
  const route: LngLat[] = [[2.33, 48.85], [2.36, 48.87], [2.35, 48.84], [2.33, 48.85]]

  // Wide enough for an end marker on the frame's edge to clear the card's 16 px text margin.
  it('keeps the route clear of the card\'s text margin', () => {
    expect(ROUTE_INSET).toBe(27)
    expect(ROUTE_INSET - MARKER_RADIUS).toBeGreaterThanOrEqual(16)
  })

  it('fits the route clear of every edge, filling one axis, centred on the other', () => {
    const pts = projectRoute(route, W, H)
    const xs = pts.map(p => p[0])
    const ys = pts.map(p => p[1])
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(ROUTE_INSET - 1e-6)
      expect(x).toBeLessThanOrEqual(W - ROUTE_INSET + 1e-6)
      expect(y).toBeGreaterThanOrEqual(ROUTE_INSET - 1e-6)
      expect(y).toBeLessThanOrEqual(H - ROUTE_INSET + 1e-6)
    }
    expect((minX + maxX) / 2).toBeCloseTo(W / 2, 6)
    expect((minY + maxY) / 2).toBeCloseTo(H / 2, 6)
    const fill = Math.max((maxX - minX) / (W - ROUTE_INSET * 2), (maxY - minY) / (H - ROUTE_INSET * 2))
    expect(fill).toBeCloseTo(1, 6)
  })

  it('projects north as up and east as right', () => {
    const [south, north] = projectRoute([[2.35, 48.84], [2.35, 48.88]], W, H)
    expect(north![1]).toBeLessThan(south![1])
    const [west, east] = projectRoute([[2.33, 48.85], [2.37, 48.85]], W, H)
    expect(east![0]).toBeGreaterThan(west![0])
  })

  it('survives a route that never moves', () => {
    const still: LngLat[] = [[2.33, 48.85], [2.33, 48.85]]
    for (const [x, y] of projectRoute(still, W, H)) {
      expect(Number.isFinite(x)).toBe(true)
      expect(Number.isFinite(y)).toBe(true)
    }
  })

  it('fits the route inside a frame of its own, top and bottom clear of the text', () => {
    const frame = { top: 90, right: 14, bottom: 80, left: 14 }
    const pts = projectRoute(route, 300, 375, frame)
    const ys = pts.map(p => p[1])
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(90 - 1e-6)
    expect(Math.max(...ys)).toBeLessThanOrEqual(375 - 80 + 1e-6)
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo((90 + 375 - 80) / 2, 6)
  })

  it('thins before projecting, so the canvas and the basemap agree', () => {
    const long: LngLat[] = Array.from({ length: 500 }, (_, i) => [2.33 + i * 1e-4, 48.85 + i * 1e-4])
    expect(projectRoute(long, W, H)).toHaveLength(simplifyRoute(long).length)
  })
})

describe('the label fences (redesign, Oct 2026)', () => {
  it('walks the route every few px, keeping its corners, so no name can sit on it', () => {
    const pts = routeFencePoints([[0, 0], [20, 0], [20, 10]], 6)
    expect(pts).toEqual([[0, 0], [6, 0], [12, 0], [18, 0], [20, 0], [20, 6], [20, 10]])
  })

  it('runs a line across the card at each band edge', () => {
    const pts = bandFencePoints(32, [80, 300], 16)
    expect(pts).toEqual([[0, 80], [16, 80], [32, 80], [0, 300], [16, 300], [32, 300]])
  })
})
