import { describe, it, expect } from 'vitest'
import { daysBetween, recentDailyLoad } from '../GetRaceReadiness'

const at = (date: string) => ({ date, avgHeartRate: 150, durationSeconds: 3600 })

describe('daysBetween', () => {
  it('counts whole days to a future date', () => {
    expect(daysBetween(new Date('2026-07-30T22:00:00'), '2026-09-05')).toBe(37)
  })

  it('is zero on race day, whatever the time of day', () => {
    expect(daysBetween(new Date('2026-09-05T06:00:00'), '2026-09-05')).toBe(0)
  })

  it('goes negative once the race has passed', () => {
    expect(daysBetween(new Date('2026-09-06T06:00:00'), '2026-09-05')).toBe(-1)
  })

  it('crosses a DST boundary without drifting a day', () => {
    expect(daysBetween(new Date('2026-10-24T12:00:00'), '2026-10-26')).toBe(2)
  })
})

describe('recentDailyLoad', () => {
  const today = new Date('2026-07-30T12:00:00')

  it('spreads the window total across every day, rest days included', () => {
    const twoRuns = [at('2026-07-29T08:00:00'), at('2026-07-25T08:00:00')]

    const perDay = recentDailyLoad(twoRuns, today)
    const perRun = recentDailyLoad([at('2026-07-29T08:00:00')], today)

    expect(perDay).toBeCloseTo(perRun * 2, 5)
  })

  it('ignores activities older than the window', () => {
    expect(recentDailyLoad([at('2026-07-10T08:00:00')], today)).toBe(0)
  })

  it('is zero with no recent training', () => {
    expect(recentDailyLoad([], today)).toBe(0)
  })
})
