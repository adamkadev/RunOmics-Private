import { describe, expect, it } from 'vitest'
import { recentTraining } from '../recentTraining'
import type { ActivitySummary } from '@/domain/activity/types'

const run = (date: string, distanceKm = 10): ActivitySummary => ({ date, distanceKm, type: 'Base' }) as ActivitySummary

describe('recentTraining', () => {
  // 2026-07-30 is a Thursday; its week starts on Monday 2026-07-27.
  const activities = [run('2026-07-29', 6.1), run('2026-07-26', 10.2), run('2026-07-21', 9), run('2026-06-30', 12)]

  it('sums the calendar week so far, from Monday', () => {
    expect(recentTraining(activities, '2026-07-30')).toMatchObject({ weekRuns: 1, weekKm: 6 })
  })

  it("leaves out last week's runs, even the ones inside the last seven days", () => {
    // Sunday the 26th is four days before the Thursday, but last week.
    expect(recentTraining([run('2026-07-26', 10.2)], '2026-07-30')).toMatchObject({ weekRuns: 0, weekKm: 0 })
  })

  it('counts Monday and today, the two ends of the week so far', () => {
    expect(recentTraining([run('2026-07-27', 8), run('2026-07-30', 5)], '2026-07-30')).toMatchObject({
      weekRuns: 2,
      weekKm: 13,
    })
  })

  it('takes Sunday as the last day of its week, not the first of the next', () => {
    expect(recentTraining(activities, '2026-07-26')).toMatchObject({ weekRuns: 2, weekKm: 19 })
  })

  it('names the last run and how long ago it was, even when it was last week', () => {
    expect(recentTraining(activities, '2026-07-27').lastRun).toEqual({ type: 'Base', daysAgo: 1, distanceKm: 10 })
    expect(recentTraining(activities, '2026-07-30').lastRun).toEqual({ type: 'Base', daysAgo: 1, distanceKm: 6 })
  })

  it('ignores runs that have not happened yet', () => {
    expect(recentTraining(activities, '2026-07-22')).toMatchObject({ weekRuns: 1, weekKm: 9 })
  })

  it('reports nothing rather than guessing when there is no history', () => {
    expect(recentTraining([], '2026-07-30')).toEqual({ weekRuns: 0, weekKm: 0, lastRun: null })
  })
})
