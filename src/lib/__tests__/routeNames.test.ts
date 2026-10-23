import { describe, expect, it } from 'vitest'
import { routeKey } from '@/lib/routeNames'

// A route's id is only its place in the list, so a name is kept against the route's own shape.
describe('routeKey', () => {
  const route = { start: [6.1234, 49.6001] as const, far: [6.1501, 49.6204] as const, distanceKm: 7.3 }

  it('is the start, the far point and the distance', () => {
    expect(routeKey(route)).toBe('6.123,49.600:6.150,49.620:7')
  })

  it('holds still while the route list moves around it', () => {
    expect(routeKey({ ...route, distanceKm: 7.4 })).toBe(routeKey(route))
  })

  it('tells two routes out of the same door apart', () => {
    expect(routeKey({ ...route, far: [6.09, 49.58] as const })).not.toBe(routeKey(route))
  })

  it('has no key for a route with no shape', () => {
    expect(routeKey({ ...route, far: null })).toBeNull()
  })
})
