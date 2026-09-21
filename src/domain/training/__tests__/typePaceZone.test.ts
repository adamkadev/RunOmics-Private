import { describe, it, expect } from 'vitest'
import { paceZoneKeyFor } from '../typePaceZone'

describe('paceZoneKeyFor', () => {
  it('maps the steady-effort types onto their zone', () => {
    expect(paceZoneKeyFor('Base')).toBe('easy')
    expect(paceZoneKeyFor('Tempo')).toBe('marathon')
    expect(paceZoneKeyFor('Threshold')).toBe('threshold')
    expect(paceZoneKeyFor('VO2Max')).toBe('vo2max')
  })

  it('has no zone for interval and race efforts', () => {
    expect(paceZoneKeyFor('Sprint')).toBeNull()
    expect(paceZoneKeyFor('Anaerobic')).toBeNull()
    expect(paceZoneKeyFor('Race')).toBeNull()
  })

  it('has no zone for an untyped session', () => {
    expect(paceZoneKeyFor(undefined)).toBeNull()
  })
})
