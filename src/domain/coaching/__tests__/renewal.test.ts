import { describe, expect, it } from 'vitest'
import { plan } from './fixtures'
import { renewalDefaults } from '../renewal'

const block = (endDate: string) => ({ ...plan().block, endDate })

describe('renewalDefaults', () => {
  it('starts the next block on the Monday after the current one ends', () => {
    expect(renewalDefaults({ block: block('2026-11-15') }, '2026-11-12').start).toBe('2026-11-16')
  })

  it('starts on the following Monday when a block ends mid-week', () => {
    expect(renewalDefaults({ block: block('2026-11-18') }, '2026-11-17').start).toBe('2026-11-23')
  })

  it('offers no start while the block ends further out than bootstrap will plan from', () => {
    expect(renewalDefaults({ block: block('2026-11-15') }, '2026-10-26').start).toBeUndefined()
  })

  it('carries the days and the weekly runs the block was written for', () => {
    const defaults = renewalDefaults({ block: block('2026-11-15'), trainingPreferences: { availableWeekdays: [3, 5, 0], runsPerWeek: 3 } }, '2026-11-12')

    expect(defaults).toEqual({ availableWeekdays: [3, 5, 0], runsPerWeek: 3, start: '2026-11-16' })
  })

  it('offers nothing without a plan to renew', () => {
    expect(renewalDefaults(null, '2026-11-12')).toEqual({})
  })
})
