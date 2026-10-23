import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

const { getAllActivities } = vi.hoisted(() => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))

const { getHeatmapData } = await import('../GetHeatmapData')

const activity = (date: string, distanceKm = 10, durationSeconds = 3000): Activity =>
  ({ id: `${date}-${distanceKm}`, date, distanceKm, durationSeconds }) as Activity

function grid(activities: Activity[] = []) {
  getAllActivities.mockReturnValue(activities)
  return getHeatmapData()
}

const CALENDAR = grid()
const A_DAY_IN_WINDOW = CALENDAR[100]!.date

describe('getHeatmapData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('covers a year of days, extended back to a week boundary', () => {
    expect(CALENDAR.length).toBeGreaterThanOrEqual(365)
    expect(CALENDAR.length).toBeLessThanOrEqual(371)
  })

  it('leaves no hole in the calendar', () => {
    const gaps = CALENDAR.filter((day, i) => {
      const previous = CALENDAR[i - 1]
      if (!previous) return false
      return new Date(day.date).getTime() - new Date(previous.date).getTime() !== 86_400_000
    })

    expect(gaps).toEqual([])
  })

  it('fills a day without a run with zeroes rather than dropping it', () => {
    expect(grid()[100]).toEqual({ date: A_DAY_IN_WINDOW, distanceKm: 0, sessionCount: 0, longRun: false, activityId: null })
  })

  it('adds up every session run on the same day', () => {
    const days = grid([
      activity(A_DAY_IN_WINDOW, 8.2),
      activity(A_DAY_IN_WINDOW, 5.1),
      activity(A_DAY_IN_WINDOW, 3),
    ])

    expect(days.find((d) => d.date === A_DAY_IN_WINDOW)).toEqual({
      date: A_DAY_IN_WINDOW,
      distanceKm: 16.3,
      sessionCount: 3,
      longRun: false,
      // The day's longest run.
      activityId: `${A_DAY_IN_WINDOW}-8.2`,
    })
  })

  it('marks a day with a run of 90 minutes or more as a long run', () => {
    const days = grid([activity(A_DAY_IN_WINDOW, 5, 1800), activity(A_DAY_IN_WINDOW, 18, 90 * 60)])
    expect(days.find((d) => d.date === A_DAY_IN_WINDOW)?.longRun).toBe(true)
  })

  it('reads the day off a timestamped date', () => {
    const days = grid([activity(`${A_DAY_IN_WINDOW}T08:12:00`, 7)])

    expect(days.find((d) => d.date === A_DAY_IN_WINDOW)?.sessionCount).toBe(1)
  })

  it('rounds the daily distance to a tenth of a kilometre', () => {
    const days = grid([activity(A_DAY_IN_WINDOW, 4.04), activity(A_DAY_IN_WINDOW, 4.04)])

    expect(days.find((d) => d.date === A_DAY_IN_WINDOW)?.distanceKm).toBe(8.1)
  })

  it('ignores runs older than the window', () => {
    const days = grid([activity('2001-01-01', 12)])

    expect(days.every((d) => d.sessionCount === 0)).toBe(true)
  })
})
