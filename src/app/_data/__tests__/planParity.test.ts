import { describe, expect, it } from 'vitest'
import type { PlannedWorkout } from '@/domain/activity/types'
import { monthDays } from '@/domain/training/monthDays'
import { planMaps, planWeekTarget, weekDates } from '@/components/plan/weekPlanDays'
import { planReading } from '../loadPlanWeeks'

const TODAY = '2026-09-30'
const run = (date: string) => ({ date, distanceKm: 8 })
const garmin = (date: string): PlannedWorkout => ({ date, name: 'Easy', type: 'Base', distanceM: 8000 })

// Tuesday run on Wednesday, Friday missed, Sunday run on the next Monday, an extra Thursday run.
const PLANNED = ['2026-09-15', '2026-09-18', '2026-09-20', '2026-09-23']
const RUNS = ['2026-09-16', '2026-09-21', '2026-09-23', '2026-09-24']
const MONDAYS = ['2026-09-14', '2026-09-21']

describe('one reading of a moved session on Today, Plan’s week and month, and Analytics', () => {
  const maps = planMaps(RUNS.map(run), PLANNED.map(garmin))
  const weekStates = new Map(MONDAYS.flatMap((monday) =>
    planWeekTarget(weekDates(new Date(`${monday}T00:00:00`)), maps, TODAY, null).days.map((day) => [day.date, day.state] as const)))
  const grid = [...weekStates.keys()]
  const month = monthDays(grid, (d) => (maps.byDate.get(d)?.length ?? 0) > 0, (d) => maps.byDatePlanned.has(d), TODAY)

  it('gives every day the same state in the week and the month', () => {
    for (const date of grid) {
      const state = month.get(date)!.state
      expect(weekStates.get(date), date).toBe(state === 'extra' ? 'done' : state)
    }
  })

  it('misses only Friday, on every screen', () => {
    const missed = (states: Iterable<[string, string]>) => [...states].filter(([, state]) => state === 'missed').map(([date]) => date)
    expect(missed(weekStates)).toEqual(['2026-09-18'])
    expect(missed([...month].map(([date, day]) => [date, day.state]))).toEqual(['2026-09-18'])
    expect(planReading(maps, PLANNED, TODAY).missed).toEqual(['2026-09-18'])
  })

  it('calls Sunday done from the run on the next Monday', () => {
    expect(weekStates.get('2026-09-20')).toBe('done')
    expect(month.get('2026-09-20')).toMatchObject({ state: 'done', ranOn: '2026-09-21' })
  })
})
