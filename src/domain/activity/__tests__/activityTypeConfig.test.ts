import { describe, it, expect } from 'vitest'
import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPE_ICONS } from '../types'
import type { ActivityType } from '../types'

// The declaration order of ACTIVITY_TYPE_CONFIG is a contract, not an
// implementation detail: src/app/api/activities/route.ts and
// src/components/activities/ActivityListClient.tsx both derive their type list
// from Object.keys(), so the filter chips and the API's accepted values follow
// whatever order this object is written in.
const EXPECTED_ORDER: ActivityType[] = [
  'Sprint',
  'Anaerobic',
  'VO2Max',
  'Threshold',
  'Tempo',
  'Base',
  'Race',
]

describe('ACTIVITY_TYPE_CONFIG', () => {
  it('lists every activity type once, hardest effort first', () => {
    expect(Object.keys(ACTIVITY_TYPE_CONFIG)).toEqual(EXPECTED_ORDER)
  })

  it('carries chartColor and nothing else', () => {
    for (const [type, config] of Object.entries(ACTIVITY_TYPE_CONFIG)) {
      expect(Object.keys(config), type).toEqual(['chartColor'])
      expect(config.chartColor, type).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('gives each type a distinct chart colour', () => {
    const colors = EXPECTED_ORDER.map((type) => ACTIVITY_TYPE_CONFIG[type].chartColor)
    expect(new Set(colors).size).toBe(EXPECTED_ORDER.length)
  })

  it('keeps the icon map in step with the config', () => {
    expect(Object.keys(ACTIVITY_TYPE_ICONS)).toEqual(EXPECTED_ORDER)
  })
})
