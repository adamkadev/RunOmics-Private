import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import { trainingHistory } from '../trainingHistory'
const run = (date: string, distanceKm: number, sport?: string) => ({ id: date, date, distanceKm, type: 'Base', sport }) as Activity

describe('training history', () => {
  it('uses contiguous ISO weeks and computes each rolling average without rounding intermediate totals', () => {
    const activities = Array.from({ length: 12 }, (_, i) => run(new Date(Date.UTC(2026, 0, 5 + 7 * i)).toISOString().slice(0, 10), (i + 1) * 10))
    const result = trainingHistory(activities, '2026-03-29')
    expect(result).toMatchObject({ historicalPeakWeekKm: 120, historicalPeakWeekRuns: 1, best4WeekAverageKm: 105, best6WeekAverageKm: 95, best8WeekAverageKm: 85, best12WeekAverageKm: 65, typicalFrequencyAtPeak: 1 })
    expect(trainingHistory([...activities].reverse(), '2026-03-29')).toEqual(result)
  })
  it('excludes non-running and future activities; counts missing weeks and boundary gaps', () => {
    const result = trainingHistory([run('2026-01-05', 40), run('2026-01-26', 8), run('2026-01-27', 100, 'cycling'), run('2026-02-01', 999)], '2026-01-31')
    expect(result).toMatchObject({ historicalPeakWeekKm: 40, best4WeekAverageKm: 12, recent28DaysKm: 48, recent28DaysRuns: 2, recentWeeklyAverageKm: 12, recentWeeklyAverageRuns: 0.5, daysSinceLastRun: 5, longestRecentGapDays: 20 })
  })
  it('does not interpret old capacity as recent mileage', () => {
    expect(trainingHistory([run('2025-01-06', 60)], '2026-01-31')).toMatchObject({ historicalPeakWeekKm: 60, recent28DaysKm: 0, longestRecentGapDays: 28 })
  })
})
