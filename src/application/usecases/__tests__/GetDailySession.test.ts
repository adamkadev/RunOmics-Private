import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { CoachingPlan } from '@/domain/coaching/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'

const { getPlannedWorkouts } = vi.hoisted(() => ({ getPlannedWorkouts: vi.fn() }))
vi.mock('../GetPlannedWorkouts', () => ({ getPlannedWorkouts }))

const { getDailySession } = await import('../GetDailySession')

const TODAY = '2026-09-09'

function repository(currentPlan: CoachingPlan | null) {
  return { getCurrentPlan: () => currentPlan }
}

function onlyOn(date: string, overrides: Partial<CoachingPlan['weeks'][number]['workouts'][number]> = {}): CoachingPlan {
  const base = plan()
  return { ...base, weeks: [{ ...base.weeks[0]!, workouts: [workout({ date, ...overrides })] }] }
}

const GARMIN: PlannedWorkout = { date: TODAY, name: 'Easy 8 km', type: 'Base', distanceM: 8_000 }

describe('getDailySession', () => {
  beforeEach(() => {
    getPlannedWorkouts.mockResolvedValue([])
  })

  it('reads the watch calendar first', async () => {
    getPlannedWorkouts.mockResolvedValue([GARMIN])

    expect(await getDailySession(TODAY, repository(onlyOn(TODAY)))).toEqual({ workout: GARMIN, source: 'garmin' })
  })

  it('falls back to the coach plan when the calendar has nothing today', async () => {
    getPlannedWorkouts.mockResolvedValue([{ ...GARMIN, date: '2026-09-11' }])

    const session = await getDailySession(TODAY, repository(onlyOn(TODAY)))

    expect(session?.source).toBe('coach')
    expect(session?.workout).toMatchObject({ date: TODAY, name: '3 × 8 min threshold', type: 'Threshold', durationSecs: 3_600 })
  })

  it('reports a rest day while a plan still surrounds today', async () => {
    expect(await getDailySession(TODAY, repository(onlyOn('2026-09-12')))).toEqual({ workout: null, source: null })
  })

  it('reports nothing at all once no plan comes within a week either way', async () => {
    expect(await getDailySession(TODAY, repository(onlyOn('2026-09-20')))).toBeNull()
    expect(await getDailySession(TODAY, repository(null))).toBeNull()
  })

  it('ignores a cancelled session, on the day and in the horizon', async () => {
    expect(await getDailySession(TODAY, repository(onlyOn(TODAY, { status: 'cancelled' })))).toBeNull()
  })
})
