import { describe, expect, it, vi } from 'vitest'

const { getCoachingOverview, getPlannedWorkouts, getGoalYears } = vi.hoisted(() => ({
  getCoachingOverview: vi.fn(),
  getPlannedWorkouts: vi.fn(),
  getGoalYears: vi.fn(),
}))
vi.mock('@/application/coaching/GetCoachingView', () => ({ getCoachingOverview }))
vi.mock('../GetPlannedWorkouts', () => ({ getPlannedWorkouts }))
vi.mock('@/infrastructure/repositories/JsonGoalRepository', () => ({ getGoalYears }))

const { getMonthKmGoals } = await import('../GetGoalsData')

const session = (date: string, km: number, state = 'completed') => ({ prescription: { date }, state, activityId: null, distanceMeters: km * 1000 })

describe('the month goal Plan and Goals share', () => {
  it('counts the coach’s sessions, past ones too, and the calendar only on days the coach left empty', async () => {
    getGoalYears.mockReturnValue([{ year: 2026, annualDistanceKm: 2000, targets: [] }])
    getCoachingOverview.mockReturnValue({
      workouts: [session('2026-11-02', 60), session('2026-11-09', 50), session('2026-11-14', 10, 'prescribed'), session('2026-11-15', 11, 'cancelled')],
    })
    getPlannedWorkouts.mockResolvedValue([
      { date: '2026-11-14', distanceM: 10_000 },
      { date: '2026-11-15', distanceM: 8_000 },
      { date: '2026-11-21', distanceM: 12_000 },
    ])

    const goals = await getMonthKmGoals('2026-11-14')

    expect(goals['2026-11']).toBe(140)
    expect(goals['2026-12']).toBeCloseTo(2000 / 12, 1)
  })
})
