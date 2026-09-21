import { describe, expect, it } from 'vitest'
import { recentTraining } from '../recentTraining'
import type { ActivitySummary } from '@/domain/activity/types'

const run = (date: string, distanceKm = 10): ActivitySummary => ({ date, distanceKm, type: 'Base' }) as ActivitySummary

describe('recentTraining', () => {
  const activities = [run('2026-07-29', 6.1), run('2026-07-26', 10.2), run('2026-07-21', 9), run('2026-06-30', 12)]

  it('sums the last seven days', () => {
    expect(recentTraining(activities, '2026-07-30')).toMatchObject({ runs: 2, km: 16 })
  })

  it('names the last run and how long ago it was', () => {
    expect(recentTraining(activities, '2026-07-30').lastRun).toEqual({ type: 'Base', daysAgo: 1, distanceKm: 6 })
  })

  it('ignores runs that have not happened yet', () => {
    expect(recentTraining(activities, '2026-07-22')).toMatchObject({ runs: 1, km: 9 })
  })

  it('reports nothing rather than guessing when there is no history', () => {
    expect(recentTraining([], '2026-07-30')).toEqual({ runs: 0, km: 0, lastRun: null })
  })
})
