import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { RecordEntry } from '../GetRecords'
import type { ShoeStats } from '../GetShoeStats'
import type { GoalYear } from '../GetGoalsData'

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({ getAthleteProfile: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonVo2maxNormsRepository', () => ({ getVo2maxNorms: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonGoalRepository', () => ({ getGoalYears: vi.fn() }))
vi.mock('@/application/usecases/GetLifetimeStats', () => ({ getLifetimeStats: vi.fn() }))
vi.mock('@/application/usecases/GetRecords', () => ({ getRecords: vi.fn() }))
vi.mock('@/application/usecases/GetShoeStats', () => ({ getShoeStats: vi.fn() }))
vi.mock('@/application/usecases/GetGoalsData', () => ({ computeProjection: vi.fn() }))
vi.mock('@/application/usecases/GetAthleteRank', () => ({ getAthleteRank: vi.fn() }))

function activity(date: string, overrides: Partial<Activity> = {}): Activity {
  return { id: date, date, distanceKm: 10, durationSeconds: 3000, ...overrides } as Activity
}

function record(key: string): RecordEntry {
  return { key, label: key, seconds: 1200, paceSecPerKm: 240, activityId: 'a', date: '2026-01-01', official: false }
}

function shoe(gearId: string, retired = false): ShoeStats {
  return {
    gearId, name: gearId, brand: 'B', maxKm: 800, alertThresholdKm: 700,
    retired, totalKm: 100, sessionCount: 10, lastUsedDate: '2026-01-01',
    firstUsedDate: '2025-01-01', kmPerWeek: 10,
    wearPercent: 13, nearingLimit: false,
  }
}

interface Options {
  activities?: Activity[]
  records?: RecordEntry[]
  shoes?: ShoeStats[]
  goalYears?: GoalYear[]
  lifetime?: { yearsTracked: number; totalDistanceKm: number; totalActivities: number } | null
}

async function run(options: Options = {}) {
  const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
  const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
  const { getVo2maxNorms } = await import('@/infrastructure/repositories/JsonVo2maxNormsRepository')
  const { getGoalYears } = await import('@/infrastructure/repositories/JsonGoalRepository')
  const { getLifetimeStats } = await import('@/application/usecases/GetLifetimeStats')
  const { getRecords } = await import('@/application/usecases/GetRecords')
  const { getShoeStats } = await import('@/application/usecases/GetShoeStats')
  const { computeProjection } = await import('@/application/usecases/GetGoalsData')
  const { getAthleteRank } = await import('@/application/usecases/GetAthleteRank')

  vi.mocked(getAllActivities).mockReturnValue(options.activities ?? [])
  vi.mocked(getAthleteProfile).mockReturnValue({ age: 34, sex: 'male' })
  vi.mocked(getVo2maxNorms).mockReturnValue({} as ReturnType<typeof getVo2maxNorms>)
  vi.mocked(getGoalYears).mockReturnValue(options.goalYears ?? [])
  vi.mocked(getLifetimeStats).mockReturnValue(options.lifetime === undefined ? null : options.lifetime)
  vi.mocked(getRecords).mockResolvedValue(options.records ?? [])
  vi.mocked(getShoeStats).mockReturnValue(options.shoes ?? [])
  vi.mocked(computeProjection).mockReturnValue(null)
  vi.mocked(getAthleteRank).mockReturnValue(null)

  const { getProfileData } = await import('../GetProfileData')
  return getProfileData()
}

describe('getProfileData', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 1, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('takes the earliest date, not whichever activity happens to be first', async () => {
    const data = await run({ activities: [activity('2026-01-10'), activity('2023-04-02'), activity('2025-06-01')] })
    expect(data.hero.sinceDate).toBe('2023-04-02')
  })

  it('reports no start date when nothing has been logged', async () => {
    const data = await run()
    expect(data.hero.sinceDate).toBeNull()
    expect(data.hero.lifetimeActivities).toBe(0)
    expect(data.hero.lifetimeDistanceKm).toBe(0)
  })

  it('counts only the current year in the year-to-date block', async () => {
    const data = await run({
      activities: [activity('2025-12-31', { distanceKm: 42 }), activity('2026-01-05'), activity('2026-01-06')],
    })

    expect(data.ytd.sessionCount).toBe(2)
    expect(data.ytd.distanceKm).toBe(20)
  })

  it('averages over the days elapsed this year, not a full 52 weeks', async () => {
    const data = await run({ activities: [activity('2026-01-05', { distanceKm: 32 })] })

    expect(data.ytd.avgKmPerWeek).toBe(7)
  })

  it('spans every year in the all-time block', async () => {
    const data = await run({
      activities: [activity('2025-12-31', { distanceKm: 42 }), activity('2026-01-05'), activity('2026-01-06')],
    })

    expect(data.allTime.sessionCount).toBe(3)
    expect(data.allTime.distanceKm).toBe(62)
  })

  it('compares last year only as far into the calendar as this year has run', async () => {
    const data = await run({
      activities: [
        activity('2024-01-20', { distanceKm: 50 }),
        activity('2025-01-15', { distanceKm: 12 }),
        activity('2025-02-01', { distanceKm: 8 }),
        activity('2025-06-30', { distanceKm: 100 }),
        activity('2026-01-20', { distanceKm: 30 }),
      ],
    })

    expect(data.prevYear?.distanceKm).toBe(20)
    expect(data.ytd.distanceKm).toBe(30)
  })

  it('measures last year over the same elapsed days, so the weekly average compares', async () => {
    const data = await run({
      activities: [
        activity('2025-01-15', { distanceKm: 12 }),
        activity('2025-02-01', { distanceKm: 8 }),
        activity('2026-01-20', { distanceKm: 30 }),
      ],
    })

    expect(data.prevYear?.sessionCount).toBe(2)
    expect(data.prevYear?.avgKmPerWeek).toBeGreaterThan(0)
  })

  it('has no prior year to compare against in a first season', async () => {
    const data = await run({ activities: [activity('2026-01-20', { distanceKm: 30 })] })

    expect(data.prevYear).toBeNull()
  })

  it('averages all-time from the first activity, not from Jan 1', async () => {
    const data = await run({ activities: [activity('2025-12-31', { distanceKm: 33 })] })

    expect(data.allTime.avgKmPerWeek).toBe(7)
    expect(data.ytd.distanceKm).toBe(0)
  })

  it('treats missing elevation and calories as zero rather than NaN', async () => {
    const data = await run({
      activities: [activity('2026-01-05', { elevationGain: 120, calories: 500 }), activity('2026-01-06')],
    })

    expect(data.ytd.elevationGainM).toBe(120)
    expect(data.ytd.calories).toBe(500)
  })

  it('shows the headline race records in short-to-long order', async () => {
    const data = await run({ records: [record('marathon'), record('5k'), record('half'), record('10k')] })

    expect(data.records.map((r) => r.key)).toEqual(['5k', '10k', 'half', 'marathon'])
  })

  it('drops headline records that have never been set, and records it does not show', async () => {
    const data = await run({ records: [record('5k'), record('longest'), record('marathon')] })

    expect(data.records.map((r) => r.key)).toEqual(['5k', 'marathon'])
  })

  it('hides retired shoes', async () => {
    const data = await run({ shoes: [shoe('a'), shoe('b', true), shoe('c')] })

    expect(data.shoes.map((s) => s.gearId)).toEqual(['a', 'c'])
  })

  it('carries no goal when none is set for the current year', async () => {
    const data = await run({ goalYears: [{ year: 2025, annualDistanceKm: 1000, targets: [] }] })
    expect(data.goal).toBeNull()
  })

  it('pairs this year goal with the same whole-km total the other pages show', async () => {
    const goalYear: GoalYear = { year: 2026, annualDistanceKm: 1500, targets: [] }
    const data = await run({ goalYears: [goalYear], activities: [activity('2026-01-05', { distanceKm: 10.4 })] })

    expect(data.goal?.goalYear).toBe(goalYear)
    expect(data.goal?.totalDistanceKm).toBe(10)
    expect(data.goal?.totalDistanceKm).toBe(data.ytd.distanceKm)
  })

  it('rounds the lifetime distance to whole kilometres', async () => {
    const data = await run({ lifetime: { yearsTracked: 3, totalDistanceKm: 4821.64, totalActivities: 412 } })

    expect(data.hero.lifetimeDistanceKm).toBe(4822)
    expect(data.hero.lifetimeActivities).toBe(412)
  })
})
