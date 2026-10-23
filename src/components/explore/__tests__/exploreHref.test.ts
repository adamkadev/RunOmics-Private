import { describe, it, expect } from 'vitest'
import {
  districtsHref,
  exploreRouteHref,
  parseExploreRoute,
  planRouteKm,
  ROUTE_KM_MAX,
  ROUTE_KM_MIN,
  stepKm,
} from '../exploreHref'

describe('stepKm', () => {
  it('rounds to the 0.5 km grid within the stepper bounds', () => {
    expect(stepKm(8.1)).toBe(8)
    expect(stepKm(9.46)).toBe(9.5)
    expect(stepKm(9.24)).toBe(9)
    expect(stepKm(0.4)).toBe(ROUTE_KM_MIN)
    expect(stepKm(64)).toBe(ROUTE_KM_MAX)
  })
})

describe('planRouteKm', () => {
  it('takes the whole session, strides and recoveries included', () => {
    // "Easy · 8 km + 6 strides" plans 9 462 m in total.
    expect(planRouteKm(9462)).toBe(9.5)
  })

  it('is null without a usable distance', () => {
    expect(planRouteKm(null)).toBeNull()
    expect(planRouteKm(undefined)).toBeNull()
    expect(planRouteKm(0)).toBeNull()
    expect(planRouteKm(Number.NaN)).toBeNull()
  })
})

describe('districtsHref', () => {
  it('opens the map on Districts, with a quartier when given', () => {
    expect(districtsHref()).toBe('/activities?view=map&layer=districts')
    expect(districtsHref('metz-5746332')).toBe('/activities?view=map&layer=districts&quartier=metz-5746332')
  })

  it('drops an id that is not a unit id', () => {
    expect(districtsHref('../etc')).toBe('/activities?view=map&layer=districts')
  })
})

describe('exploreRouteHref', () => {
  it('carries the quartier, distance, pace and origin', () => {
    expect(exploreRouteHref({ km: 9.46, paceSecPerKm: 353.4, quartier: 'insee-57049', from: 'plan' })).toBe(
      '/activities?view=map&explore=route&quartier=insee-57049&km=9.5&pace=353&from=plan',
    )
  })

  it('carries the planned session’s day, so the generator names that session', () => {
    expect(exploreRouteHref({ km: 16, paceSecPerKm: 345, date: '2026-10-24', from: 'plan' })).toBe(
      '/activities?view=map&explore=route&km=16&pace=345&date=2026-10-24&from=plan',
    )
    expect(exploreRouteHref({ date: '24/10/2026' })).toBe('/activities?view=map&explore=route')
  })

  it('leaves out what it does not know', () => {
    expect(exploreRouteHref({})).toBe('/activities?view=map&explore=route')
    expect(exploreRouteHref({ km: null, paceSecPerKm: 30 })).toBe('/activities?view=map&explore=route')
  })
})

describe('parseExploreRoute', () => {
  it('is null unless the link opens the generator', () => {
    expect(parseExploreRoute({ explore: null })).toBeNull()
    expect(parseExploreRoute({ explore: 'districts' })).toBeNull()
  })

  it('reads back what exploreRouteHref wrote', () => {
    const href = exploreRouteHref({ km: 9.46, paceSecPerKm: 353, quartier: 'metz-5746332', date: '2026-10-24', from: 'profile' })
    const q = new URL(href, 'https://run.example').searchParams
    expect(
      parseExploreRoute({
        explore: q.get('explore'),
        quartier: q.get('quartier'),
        km: q.get('km'),
        pace: q.get('pace'),
        date: q.get('date'),
        from: q.get('from'),
      }),
    ).toEqual({ quartier: 'metz-5746332', km: 9.5, pace: 353, date: '2026-10-24', from: 'profile' })
  })

  it('falls back to defaults for anything malformed', () => {
    expect(parseExploreRoute({ explore: 'route', quartier: 'NOT AN ID', km: 'abc', pace: '-4', date: '2026-13-40', from: 'elsewhere' })).toEqual({
      quartier: null,
      km: null,
      pace: null,
      date: null,
      from: null,
    })
    expect(parseExploreRoute({ explore: 'route', km: '0' })?.km).toBeNull()
    expect(parseExploreRoute({ explore: 'route', km: '100' })?.km).toBe(ROUTE_KM_MAX)
  })
})
