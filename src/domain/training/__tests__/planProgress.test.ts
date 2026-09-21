import { describe, it, expect } from 'vitest'
import { weeksInPlan } from '../planProgress'

const ESCHER = { startDate: '2026-06-27', endDate: '2026-09-05' }

describe('weeksInPlan', () => {
  it('matches what Garmin Connect shows for the same plan', () => {
    expect(weeksInPlan(ESCHER, '2026-07-22')).toEqual({ done: 5, total: 11 })
  })

  it('counts the week the plan opens in as week 1, even mid-week', () => {
    expect(weeksInPlan(ESCHER, '2026-06-27')).toEqual({ done: 1, total: 11 })
    expect(weeksInPlan(ESCHER, '2026-06-29')).toEqual({ done: 2, total: 11 })
  })

  it('never runs past the last week or before the first', () => {
    expect(weeksInPlan(ESCHER, '2026-12-01')?.done).toBe(11)
    expect(weeksInPlan(ESCHER, '2026-01-01')?.done).toBe(1)
  })

  it('is null without a dated plan', () => {
    expect(weeksInPlan(null, '2026-07-22')).toBeNull()
  })
})
