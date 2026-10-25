import { describe, expect, it } from 'vitest'
import { activityRouteThumb, encodeRouteThumb, routeThumbPath, ROUTE_THUMB_BOX } from '../routeThumb'

function loop(n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / (n - 1)) * Math.PI * 2
    return [6.13 + Math.cos(a) * 0.01, 49.61 + Math.sin(a) * 0.006]
  })
}

function points(path: string): [number, number][] {
  return [...path.matchAll(/[ML](\d+) (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])])
}

const thumb = (route: [number, number][] | null) => routeThumbPath(encodeRouteThumb(route))

describe('routeThumbPath', () => {
  it('simplifies a long route to about 60 points inside the box', () => {
    const pts = points(thumb(loop(3000))!)
    expect(pts.length).toBeGreaterThan(30)
    expect(pts.length).toBeLessThanOrEqual(60)
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(ROUTE_THUMB_BOX)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(ROUTE_THUMB_BOX)
      expect(Number.isNaN(x) || Number.isNaN(y)).toBe(false)
    }
  })

  it('draws north up', () => {
    const pts = points(thumb([[6, 49], [6, 49.01]])!)
    expect(pts[1]![1]).toBeLessThan(pts[0]![1])
  })

  it('is null for a treadmill run or a fix that never moved', () => {
    expect(thumb(null)).toBeNull()
    expect(thumb([[6, 49]])).toBeNull()
    expect(thumb([[6, 49], [6, 49]])).toBeNull()
  })

  it('travels as well under half the length of the path it draws', () => {
    const encoded = encodeRouteThumb(loop(3000))!
    expect(encoded.length * 2).toBeLessThan(routeThumbPath(encoded)!.length)
  })
})

describe('activityRouteThumb', () => {
  it('works the path out once per activity', () => {
    const route = loop(200)
    const first = activityRouteThumb({ id: 'a1', route })
    expect(activityRouteThumb({ id: 'a1', route })).toBe(first)
    expect(activityRouteThumb({ id: 't1', route: null })).toBeNull()
  })
})
