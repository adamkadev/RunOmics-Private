import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { TrainingStatusDay } from '@/infrastructure/repositories/JsonTrainingStatusRepository'

vi.mock('@/infrastructure/repositories/JsonTrainingStatusRepository', () => ({
  getTrainingStatusDays: vi.fn(),
  getLatestTrainingStatusDay: () => null,
}))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({ getAthleteProfile: () => ({ maxHrBpm: 200, restingHrBpm: 55 }) }))

async function run(days: TrainingStatusDay[]) {
  const { getTrainingStatusDays } = await import('@/infrastructure/repositories/JsonTrainingStatusRepository')
  vi.mocked(getTrainingStatusDays).mockReturnValue(days)

  const { getTrainingStatusHistory } = await import('../GetTrainingStatusHistory')
  return getTrainingStatusHistory()
}

const dayAt = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)

function series(count: number, status: string | undefined = 'productive'): TrainingStatusDay[] {
  return Array.from({ length: count }, (_, i) =>
    status === undefined ? { date: dayAt(i) } : { date: dayAt(i), status },
  )
}

const unrated = (count: number): TrainingStatusDay[] => Array.from({ length: count }, (_, i) => ({ date: dayAt(i) }))

describe('getTrainingStatusHistory', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('null below the two weeks the chart needs to say anything', async () => {
    expect(await run(series(13))).toBeNull()
    expect(await run(series(14))).not.toBeNull()
  })

  it('null when no day carries a status Garmin rated', async () => {
    expect(await run(unrated(30))).toBeNull()
  })

  it('null when every status is one we have no slot for', async () => {
    expect(await run(series(30, 'someFutureGarminStatus'))).toBeNull()
  })

  it('translates Garmin status names into the app vocabulary', async () => {
    const data = await run([...series(14), { date: '2026-01-15', status: 'peaking' }])

    expect(data?.points.at(0)?.status).toBe('productive')
    expect(data?.points.at(-1)?.status).toBe('fresh')
  })

  it('keeps unrated days in the series as null rather than dropping them', async () => {
    const data = await run([...series(14), { date: '2026-01-15' }])

    expect(data?.points).toHaveLength(15)
    expect(data?.points.at(-1)?.status).toBeNull()
  })

  it('shapes the optimal band as [min, height] so the chart can stack it', async () => {
    const days = series(14)
    days[0] = { ...days[0]!, chronicLoadMin: 300, chronicLoadMax: 750 }
    const data = await run(days)

    expect(data?.points[0]?.targetBand).toEqual([300, 450])
  })

  it('leaves the band null when Garmin gave only one bound', async () => {
    const days = series(14)
    days[0] = { ...days[0]!, chronicLoadMin: 300 }
    const data = await run(days)

    expect(data?.points[0]?.targetBand).toBeNull()
  })

  it('carries the loads through, absent ones as null', async () => {
    const days = series(14)
    days[0] = { ...days[0]!, acuteLoad: 420, chronicLoad: 510 }
    const data = await run(days)

    expect(data?.points[0]).toMatchObject({ acuteLoad: 420, chronicLoad: 510 })
    expect(data?.points[1]).toMatchObject({ acuteLoad: null, chronicLoad: null })
  })

  it('caps the payload at three years, keeping the most recent days', async () => {
    const data = await run(series(1200))

    expect(data?.points).toHaveLength(1095)
    expect(data?.points.at(-1)?.date).toBe(series(1200).at(-1)?.date)
  })
})

describe('getLocalTrainingStatusHistory', () => {
  const TODAY = '2026-10-26'
  const runs = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ date: dayAt(from + i), avgHeartRate: 160, durationSeconds: 3000, distanceKm: 9 }))
      .filter((_, i) => i % 2 === 0)
      .reverse() as unknown as Activity[]

  async function local(activities: Activity[]) {
    const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
    vi.mocked(getAllActivities).mockReturnValue(activities)
    return (await import('../GetTrainingStatusHistory')).getLocalTrainingStatusHistory()
  }

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`))
  })
  afterEach(() => vi.useRealTimers())

  it("ends on the status Today reads, for a watch that rates none", async () => {
    const days = (Date.parse(TODAY) - Date.parse(dayAt(0))) / 86_400_000
    const data = await local(runs(days - 60, days))
    const { getTrainingStatus } = await import('../GetTrainingStatus')

    expect(data?.source).toBe('local')
    expect(data?.points.at(-1)).toMatchObject({ date: TODAY, status: (await getTrainingStatus())?.status })
  })

  it('rates no day four weeks or more after the last run', async () => {
    const days = (Date.parse(TODAY) - Date.parse(dayAt(0))) / 86_400_000
    const data = await local(runs(days - 120, days - 60))

    expect(data?.points.find((p) => p.date === dayAt(days - 60 + 27))?.status).not.toBeNull()
    expect(data?.points.filter((p) => p.date >= dayAt(days - 60 + 28)).every((p) => p.status === null)).toBe(true)
  })

  it('null without a run', async () => {
    expect(await local([])).toBeNull()
  })
})
