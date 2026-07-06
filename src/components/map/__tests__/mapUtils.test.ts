import { describe, it, expect } from 'vitest'
import { matchesFilters } from '../mapUtils'
import type { RouteMeta } from '@/application/usecases/GetAllRoutes'

const meta = (over: Partial<RouteMeta> = {}): RouteMeta => ({ type: 'Base', year: '2026', distanceKm: 5, ...over })

describe('matchesFilters', () => {
  it('false with no meta', () => {
    expect(matchesFilters(undefined, null)).toBe(false)
  })

  it('true with no year or race filter', () => {
    expect(matchesFilters(meta(), null)).toBe(true)
  })

  it('filters by year', () => {
    expect(matchesFilters(meta({ year: '2025' }), '2026')).toBe(false)
    expect(matchesFilters(meta({ year: '2026' }), '2026')).toBe(true)
  })
})
