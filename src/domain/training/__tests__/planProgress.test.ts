import { describe, it, expect } from 'vitest'
import { weeksInPlan } from '../planProgress'

// The athlete's real Garmin Coach plan (data/training_plan.json), which
// Garmin Connect itself reports as "semaine 5 sur 11" on 22 July 2026.
const ESCHER = { startDate: '2026-06-27', endDate: '2026-09-05' }

describe('weeksInPlan', () => {
  it('matches what Garmin Connect shows for the same plan', () => {
    expect(weeksInPlan(ESCHER, '2026-07-22')).toEqual({ done: 5, total: 11 })
  })

  it('counts the week the plan opens in as week 1, even mid-week', () => {
    // 27 June 2026 is a Saturday: its week is the week of Monday 22 June.
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
