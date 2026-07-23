import { describe, expect, it } from 'vitest'
import { ROUTE_PADDING, projectRoute, routePadding, routePaddingPx, simplifyRoute, type LngLat } from '@/lib/shareCardMap'

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

describe('routePaddingPx', () => {
  it('measures the padding off the short side, so it is even on all four', () => {
    expect(routePaddingPx(390, 844)).toBe(Math.round(390 * ROUTE_PADDING))
    expect(routePaddingPx(390, 390)).toBe(Math.round(390 * ROUTE_PADDING))
  })
})

describe('routePadding', () => {
  it('stays symmetric on a square frame', () => {
    const p = routePadding(390, 390)
    const base = routePaddingPx(390, 390)
    expect(p).toEqual({ top: base, right: base, bottom: base, left: base })
  })

  it('opens the top and bottom on the tall card, keeping the sides even', () => {
    const p = routePadding(390, 693)
    expect(p.left).toBe(p.right)
    // Room reserved for the title above and the stats panel below.
    expect(p.top).toBeGreaterThan(p.left)
    expect(p.bottom).toBeGreaterThan(p.top)
  })
})

describe('projectRoute', () => {
  const W = 390
  const H = 693
  const route: LngLat[] = [[2.33, 48.85], [2.36, 48.87], [2.35, 48.84], [2.33, 48.85]]

  it('centers the route horizontally and within the padded band vertically', () => {
    const pts = projectRoute(route, W, H)
    const xs = pts.map(p => p[0])
    const ys = pts.map(p => p[1])
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]

    const p = routePadding(W, H)
    expect((minX + maxX) / 2).toBeCloseTo((p.left + (W - p.right)) / 2, 6)
    expect((minY + maxY) / 2).toBeCloseTo((p.top + (H - p.bottom)) / 2, 6)

    // The axis that runs out of room first fills the padded frame exactly; the
    // other is looser, since the fit preserves the aspect ratio. Same contract
    // as MapLibre's fitBounds, which takes over once the basemap has rendered.
    const fillX = (maxX - minX) / (W - p.left - p.right)
    const fillY = (maxY - minY) / (H - p.top - p.bottom)
    expect(Math.max(fillX, fillY)).toBeCloseTo(1, 6)
    expect(Math.min(fillX, fillY)).toBeLessThanOrEqual(1)
  })

  it('keeps every point inside the padded frame', () => {
    const p = routePadding(W, H)
    for (const [x, y] of projectRoute(route, W, H)) {
      expect(x).toBeGreaterThanOrEqual(p.left - 1e-6)
      expect(x).toBeLessThanOrEqual(W - p.right + 1e-6)
      expect(y).toBeGreaterThanOrEqual(p.top - 1e-6)
      expect(y).toBeLessThanOrEqual(H - p.bottom + 1e-6)
    }
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

  it('thins before projecting, so the canvas and the basemap agree', () => {
    const long: LngLat[] = Array.from({ length: 500 }, (_, i) => [2.33 + i * 1e-4, 48.85 + i * 1e-4])
    expect(projectRoute(long, W, H)).toHaveLength(simplifyRoute(long).length)
  })
})
