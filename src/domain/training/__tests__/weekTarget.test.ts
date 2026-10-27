import { describe, expect, it } from 'vitest'
import { weekTarget, type WeekTargetDay } from '../weekTarget'

const TODAY = '2026-09-25'

function day(date: string, overrides: Partial<WeekTargetDay> = {}): WeekTargetDay {
  return { date, ranKm: 0, runs: 0, plannedKm: null, plannedSessions: 0, ...overrides }
}

// Mon-Wed planned and not run, Thu rest, Fri's 6 km threshold run 6.11 km, Sat
// 13 km still to come, Sun rest.
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

  it('gives no plan km when every session is timed, not 0', () => {
    const timed = WEEK.map((d) => ({ ...d, plannedKm: null }))
    expect(weekTarget(timed, TODAY, null).planKm).toBeNull()
    expect(weekTarget(timed, TODAY, null).planSessions).toBe(5)
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

const stateOf = (d: WeekTargetDay) => weekTarget([d], TODAY, null).days[0]!.state

describe('a day’s state', () => {
  it('reads each day as done, missed, planned or rest', () => {
    expect(weekTarget(WEEK, TODAY, null).days.map((d) => d.state)).toEqual([
      'missed', 'missed', 'missed', 'rest', 'done', 'planned', 'rest',
    ])
  })

  it('leaves a planned session today as planned until the day is over', () => {
    expect(stateOf(day(TODAY, { plannedSessions: 1 }))).toBe('planned')
  })

  it('calls a session run the next day done on both days, counted once', () => {
    const moved = weekTarget([
      day('2026-09-22', { plannedKm: 9, plannedSessions: 1 }),
      day('2026-09-23', { ranKm: 9.2, runs: 1 }),
    ], TODAY, null)
    expect(moved.days.map(({ state, ranOn, standsFor }) => ({ state, ranOn, standsFor }))).toEqual([
      { state: 'done', ranOn: '2026-09-23', standsFor: undefined },
      { state: 'done', ranOn: undefined, standsFor: '2026-09-22' },
    ])
    expect(moved).toMatchObject({ plannedDone: 1, unplannedRuns: 0, missedSessions: 0 })
  })

  it('matches a session across the week’s edge through the days either side', () => {
    const sunday = [day('2026-09-27', { plannedKm: 13, plannedSessions: 1 })]
    const nextMonday = day('2026-09-28', { ranKm: 13, runs: 1 })
    expect(weekTarget(sunday, '2026-09-29', null).days[0]!.state).toBe('missed')
    expect(weekTarget(sunday, '2026-09-29', null, [nextMonday]).days[0]).toMatchObject({ state: 'done', ranOn: '2026-09-28' })
  })

  it('counts an unplanned run as done', () => {
    expect(stateOf(day('2026-09-24', { ranKm: 5, runs: 1 }))).toBe('done')
  })
})

describe('planned sessions done (v5.5 #7)', () => {
  // Aug 17-23: two unplanned runs (Tue, Wed), both planned sessions (Sat, Sun) missed.
  const week = [
    day('2026-08-18', { ranKm: 10.95, runs: 1 }),
    day('2026-08-19', { ranKm: 10.02, runs: 1 }),
    day('2026-08-22', { plannedKm: 6.97, plannedSessions: 1 }),
    day('2026-08-23', { plannedKm: 13.81, plannedSessions: 1 }),
  ]

  it('counts only the planned sessions run on their day, and the unplanned runs apart', () => {
    const target = weekTarget(week, '2026-09-25', null)
    expect(target).toMatchObject({ ranKm: 21, planKm: 20.8, planSessions: 2, plannedDone: 0, unplannedRuns: 2, missedSessions: 2 })
  })

  it('counts a planned day run as done, once', () => {
    const target = weekTarget([day('2026-08-22', { ranKm: 7, runs: 2, plannedKm: 7, plannedSessions: 1 })], '2026-09-25', null)
    expect(target).toMatchObject({ plannedDone: 1, unplannedRuns: 0 })
  })
})
