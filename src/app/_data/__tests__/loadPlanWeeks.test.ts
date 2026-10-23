import { describe, expect, it } from 'vitest'
import type { PlannedWorkout } from '@/domain/activity/types'
import { planMaps } from '@/components/plan/weekPlanDays'
import { planReading } from '../loadPlanWeeks'

const TODAY = '2026-09-26'
const run = (date: string) => ({ date, distanceKm: 8 })
const garmin = (date: string): PlannedWorkout => ({ date, name: 'Easy', type: 'Base', distanceM: 8000 })

const PLANNED = ['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-19', '2026-09-22', '2026-09-24', '2026-09-26']

describe('the plan as Analytics reads it', () => {
  it('misses a session only as Plan does: past, and no run on the day or beside it', () => {
    // Thursday's run stands in for Wednesday, the next Wednesday's for that
    // Tuesday; today's session is still to come.
    const maps = planMaps([run('2026-09-14'), run('2026-09-17'), run('2026-09-23')], PLANNED.map(garmin))
    const reading = planReading(maps, PLANNED, TODAY)
    expect(reading.missed).toEqual(['2026-09-18', '2026-09-19', '2026-09-24'])
    expect(reading.weeks).toEqual([
      { week: '2026-09-14', planKm: 32, planQuality: 0 },
      { week: '2026-09-21', planKm: 24, planQuality: 0 },
    ])
  })

  it('reads nothing without a plan', () => {
    expect(planReading(planMaps([run('2026-09-14')], []), [], TODAY)).toEqual({ weeks: [], missed: [] })
  })
})
