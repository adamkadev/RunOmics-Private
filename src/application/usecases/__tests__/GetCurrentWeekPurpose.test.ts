import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActivitySummary, HrZone, PlannedWorkout } from '@/domain/activity/types'
import type { TrainingPlan } from '../GetTrainingPlan'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { isoWeekNumber } from '@/lib/calendarDate'

const { getActivitySummaries, getPlannedWorkouts, getTrainingPlan, getAthleteProfile } = vi.hoisted(() => ({
  getActivitySummaries: vi.fn(),
  getPlannedWorkouts: vi.fn(),
  getTrainingPlan: vi.fn(),
  getAthleteProfile: vi.fn(),
}))

vi.mock('../GetActivities', () => ({ getActivitySummaries }))
vi.mock('../GetPlannedWorkouts', () => ({ getPlannedWorkouts }))
vi.mock('../GetTrainingPlan', () => ({ getTrainingPlan }))
vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({ getAthleteProfile }))

const { getCurrentWeekPurpose } = await import('../GetCurrentWeekPurpose')

// Wednesday of the week starting Monday 20 July 2026.
const NOW = new Date('2026-07-22T10:00:00')
const MONDAY = '2026-07-20'

const hrZone = (zone: number, seconds: number): HrZone => ({ zone, seconds, percent: 0, minBpm: 100, maxBpm: 200 })

function summary(date: string, overrides: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    id: date,
    date,
    type: 'Base',
    distanceKm: 10,
    durationSeconds: 3000,
    avgHeartRate: 145,
    hrZones: [hrZone(2, 3000)],
    week: isoWeekNumber(new Date(date + 'T00:00:00')),
    ...overrides,
  } as ActivitySummary
}

const workout = (date: string, overrides: Partial<PlannedWorkout> = {}): PlannedWorkout => ({
  date,
  name: 'Base run',
  type: 'Base',
  ...overrides,
})

interface Setup {
  activities?: ActivitySummary[]
  planned?: PlannedWorkout[]
  plan?: TrainingPlan | null
  athlete?: AthleteProfile
}

function run({ activities = [summary(MONDAY)], planned = [], plan = null, athlete = {} }: Setup = {}) {
  getActivitySummaries.mockReturnValue(activities)
  getPlannedWorkouts.mockResolvedValue(planned)
  getTrainingPlan.mockReturnValue(plan)
  getAthleteProfile.mockReturnValue(athlete)

  return getCurrentWeekPurpose(NOW)
}

// One steady hour in each of the seven weeks the comparison averages over.
const PRIOR_MONDAYS = [
  '2026-06-01',
  '2026-06-08',
  '2026-06-15',
  '2026-06-22',
  '2026-06-29',
  '2026-07-06',
  '2026-07-13',
]
const priorWeeks = () => PRIOR_MONDAYS.map((date) => summary(date, { durationSeconds: 3600 }))

describe('getCurrentWeekPurpose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('null before the athlete has run at all', async () => {
    expect(await run({ activities: [] })).toBeNull()
  })

  it('opens the week on its Monday', async () => {
    expect((await run())?.weekStart).toBe(MONDAY)
  })

  it('counts the sessions and the distance run since that Monday', async () => {
    const week = await run({
      activities: [summary(MONDAY, { distanceKm: 12.4 }), summary('2026-07-22', { distanceKm: 8.2 })],
    })

    expect(week?.sessions).toBe(2)
    expect(week?.distanceKm).toBe(20.6)
  })

  it('leaves last week and next week out of the count', async () => {
    const week = await run({
      activities: [summary('2026-07-19'), summary(MONDAY), summary('2026-07-27')],
    })

    expect(week?.sessions).toBe(1)
  })

  it('counts two runs on the same day as two sessions', async () => {
    const week = await run({ activities: [summary(MONDAY), summary(MONDAY)] })

    expect(week?.sessions).toBe(2)
  })

  it('counts everything that is not an easy base run as a key session', async () => {
    const week = await run({
      activities: [summary(MONDAY), summary('2026-07-21', { type: 'Threshold' }), summary('2026-07-22', { type: 'Race' })],
    })

    expect(week?.keySessions).toBe(2)
  })

  it('reads the hard share off the time spent in the upper zones', async () => {
    const week = await run({
      activities: [
        summary(MONDAY, { hrZones: [hrZone(2, 3000), hrZone(4, 1000)] }),
      ],
    })

    expect(week?.hardPct).toBe(25)
  })

  it('leaves the hard share unknown when no run recorded its zones', async () => {
    expect((await run({ activities: [summary(MONDAY, { hrZones: [] })] }))?.hardPct).toBeNull()
  })

  it('null plan summary when the plan holds nothing this week', async () => {
    const week = await run({ planned: [workout('2026-07-13')] })

    expect(week?.planned).toBeNull()
  })

  it('summarises what the plan holds for the week', async () => {
    const week = await run({
      planned: [workout(MONDAY), workout('2026-07-22', { type: 'Threshold' }), workout('2026-07-25', { type: 'Race' })],
    })

    expect(week?.planned).toEqual({ total: 3, key: 2 })
  })

  it('null adherence when nothing was planned to adhere to', async () => {
    expect((await run())?.adherence).toBeNull()
  })

  it('measures adherence over the whole week, not just the days elapsed', async () => {
    const week = await run({
      activities: [summary(MONDAY)],
      planned: [workout(MONDAY), workout('2026-07-22'), workout('2026-07-24'), workout('2026-07-26')],
    })

    expect(week?.adherence).toEqual({ planned: 4, done: 1, percent: 25 })
  })

  it('null comparison until there are enough weeks behind it', async () => {
    expect((await run())?.comparison).toBeNull()
  })

  it('measures the week against the ones before it, not against itself', async () => {
    const week = await run({
      activities: [summary(MONDAY, { durationSeconds: 3600 }), ...priorWeeks()],
    })

    expect(week?.comparison?.percent).toBe(100)
    expect(week?.comparison?.level).toBe('normal')
  })

  it('flags a week running well above the recent baseline', async () => {
    const week = await run({
      activities: [
        summary(MONDAY, { durationSeconds: 3600 }),
        summary('2026-07-21', { durationSeconds: 3600 }),
        ...priorWeeks(),
      ],
    })

    expect(week?.comparison?.level).toBe('high')
  })

  it('null phase when the athlete is following no plan', async () => {
    expect((await run())?.planPhase).toBeNull()
  })

  it('names the phase the plan puts this week in', async () => {
    const week = await run({
      plan: {
        name: 'Half Marathon',
        startDate: '2026-03-02',
        endDate: '2026-09-06',
        ranges: [{ phase: 'build', startDate: '2026-07-06', endDate: '2026-08-02' }],
      },
    })

    expect(week?.planPhase).toBe('build')
  })

  it('lists the sessions the plan still holds for the days left', async () => {
    const week = await run({
      planned: [workout('2026-07-24', { name: 'Threshold 3x8', type: 'Threshold' }), workout('2026-07-26')],
    })

    expect(week?.remaining).toEqual([
      { date: '2026-07-24', name: 'Threshold 3x8', type: 'Threshold' },
      { date: '2026-07-26', name: 'Base run', type: 'Base' },
    ])
  })

  it('still lists a session planned for today, since the day is not over', async () => {
    const week = await run({ activities: [summary(MONDAY)], planned: [workout('2026-07-22')] })

    expect(week?.remaining.map((s) => s.date)).toEqual(['2026-07-22'])
  })

  it('drops a session from the days already behind', async () => {
    const week = await run({ planned: [workout(MONDAY), workout('2026-07-24')] })

    expect(week?.remaining.map((s) => s.date)).toEqual(['2026-07-24'])
  })

  it('drops a session from a day that has already been run', async () => {
    const week = await run({
      activities: [summary('2026-07-24')],
      planned: [workout('2026-07-24'), workout('2026-07-26')],
    })

    expect(week?.remaining.map((s) => s.date)).toEqual(['2026-07-26'])
  })

  it('leaves an untyped planned session without a type rather than guessing one', async () => {
    const week = await run({ planned: [workout('2026-07-24', { type: undefined })] })

    expect(week?.remaining[0]?.type).toBeNull()
  })
})
