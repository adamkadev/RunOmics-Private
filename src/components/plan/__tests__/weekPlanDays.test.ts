import { describe, expect, it } from 'vitest'
import type { PlannedWorkout } from '@/domain/activity/types'
import { currentWeekTarget, formatWeekKm, planMaps, resolveDayType, weekPlanDays } from '../weekPlanDays'

const run = (date: string, distanceKm: number) => ({ date, distanceKm })
const garmin = (date: string, km: number): PlannedWorkout => ({ date, name: 'Run', distanceM: km * 1000 })
const coach = (date: string, km: number, state: 'prescribed' | 'cancelled' = 'prescribed') => ({
  state,
  distanceMeters: km * 1000,
  prescription: { date, type: 'easy' as const },
})

describe('weekPlanDays', () => {
  it("takes the coach's prescription over Garmin's plan for a day", () => {
    const maps = planMaps([], [garmin('2026-09-22', 8)], [coach('2026-09-22', 12)])

    expect(weekPlanDays(['2026-09-22'], maps)[0]).toMatchObject({ plannedKm: 12, plannedSessions: 1 })
  })

  it('treats a cancelled prescription as no plan at all', () => {
    const maps = planMaps([], [], [coach('2026-09-22', 12, 'cancelled')])

    expect(weekPlanDays(['2026-09-22'], maps)[0]).toMatchObject({ plannedKm: null, plannedSessions: 0 })
  })

  it('adds up every run on a day', () => {
    const maps = planMaps([run('2026-09-22', 5), run('2026-09-22', 3)], [])

    expect(weekPlanDays(['2026-09-22'], maps)[0]).toMatchObject({ ranKm: 8, runs: 2 })
  })
})

describe('currentWeekTarget', () => {
  // Thursday 24 September 2026, in the week of Monday the 21st.
  it('counts only the Monday-to-Sunday week that holds today', () => {
    const maps = planMaps([run('2026-09-20', 25), run('2026-09-22', 12)], [garmin('2026-09-26', 10)])
    const target = currentWeekTarget(maps, '2026-09-24', 40)

    expect(target.ranKm).toBe(12)
    expect(target.planKm).toBe(10)
    expect(target.goalKm).toBe(40)
    expect(target.days.map((d) => d.date)).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
    ])
  })
})

describe('formatWeekKm', () => {
  it('keeps a decimal only where it tells the reader something', () => {
    expect(formatWeekKm(6.1)).toBe('6.1')
    expect(formatWeekKm(6)).toBe('6')
    expect(formatWeekKm(52.4)).toBe('52')
  })
})

// A threshold session the watch filed as tempo: a run day shows the run by
// its name, as Activities does.
describe('a run day\'s type', () => {
  it('is the run as its name set it, over the watch\'s filing', () => {
    expect(resolveDayType([{ type: 'Tempo', description: "Threshold 2 x 7:00 - 2x7'@4:25" }], 'Tempo')).toEqual({ type: 'Threshold', planned: 'Tempo' })
    expect(resolveDayType([{ type: 'Tempo', description: 'Base' }], undefined)).toEqual({ type: 'Base' })
    expect(resolveDayType([{ type: 'Tempo', description: 'Morning Run' }], undefined)).toEqual({ type: 'Tempo' })
  })
})
