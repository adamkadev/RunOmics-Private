import { describe, expect, it } from 'vitest'
import { weekDayState, weekTarget, type WeekTargetDay } from '../weekTarget'

const TODAY = '2026-09-25'

function day(date: string, overrides: Partial<WeekTargetDay> = {}): WeekTargetDay {
  return { date, ranKm: 0, runs: 0, plannedKm: null, plannedSessions: 0, ...overrides }
}

// The week the audit read: Mon-Wed planned and not run, Thu rest, Fri's 6 km
// threshold run 6.11 km, Sat 13 km still to come, Sun rest.
const WEEK: WeekTargetDay[] = [
  day('2026-09-21', { plannedKm: 11, plannedSessions: 1 }),
  day('2026-09-22', { plannedKm: 9, plannedSessions: 1 }),
  day('2026-09-23', { plannedKm: 13, plannedSessions: 1 }),
  day('2026-09-24'),
  day('2026-09-25', { plannedKm: 6, plannedSessions: 1, ranKm: 6.11, runs: 1 }),
  day('2026-09-26', { plannedKm: 13, plannedSessions: 1 }),
  day('2026-09-27'),
]

describe('weekTarget', () => {
  it('measures what was run against the plan, never blended into it', () => {
    const target = weekTarget(WEEK, TODAY, 23)

    expect(target.ranKm).toBe(6.1)
    expect(target.planKm).toBe(52)
    expect(target.ranSessions).toBe(1)
    expect(target.planSessions).toBe(5)
  })

  it('keeps the volume goal a number of its own', () => {
    expect(weekTarget(WEEK, TODAY, 23).goalKm).toBe(23)
    expect(weekTarget(WEEK, TODAY, null).goalKm).toBeNull()
    expect(weekTarget(WEEK, TODAY, 0).goalKm).toBeNull()
  })

  it('counts the planned days that are over and were not run as missed', () => {
    expect(weekTarget(WEEK, TODAY, null).missedSessions).toBe(3)
  })

  it('has no plan total when nothing was planned', () => {
    const target = weekTarget([day('2026-09-21', { ranKm: 8, runs: 1 })], TODAY, 23)

    expect(target.planKm).toBeNull()
    expect(target.planSessions).toBe(0)
    expect(target.ranKm).toBe(8)
  })
})

describe('weekDayState', () => {
  it('reads each day as done, missed, planned or rest', () => {
    expect(weekTarget(WEEK, TODAY, null).days.map((d) => d.state)).toEqual([
      'missed', 'missed', 'missed', 'rest', 'done', 'planned', 'rest',
    ])
  })

  it('leaves a planned session today as planned until the day is over', () => {
    expect(weekDayState(day(TODAY, { plannedSessions: 1 }), TODAY)).toBe('planned')
  })

  it('counts an unplanned run as done', () => {
    expect(weekDayState(day('2026-09-24', { ranKm: 5, runs: 1 }), TODAY)).toBe('done')
  })
})
