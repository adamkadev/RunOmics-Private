import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TrainingStatusDay } from '@/infrastructure/repositories/JsonTrainingStatusRepository'

vi.mock('@/infrastructure/repositories/JsonTrainingStatusRepository', () => ({
  getTrainingStatusDays: vi.fn(),
}))

async function run(days: TrainingStatusDay[]) {
  const { getTrainingStatusDays } = await import('@/infrastructure/repositories/JsonTrainingStatusRepository')
  vi.mocked(getTrainingStatusDays).mockReturnValue(days)

  const { getTrainingStatusHistory } = await import('../GetTrainingStatusHistory')
  return getTrainingStatusHistory()
}

const dayAt = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)

/** `count` consecutive days from 2026-01-01. `status` is omitted entirely when undefined. */
function series(count: number, status: string | undefined = 'productive'): TrainingStatusDay[] {
  return Array.from({ length: count }, (_, i) =>
    status === undefined ? { date: dayAt(i) } : { date: dayAt(i), status },
  )
}

/** Same span, but with no day Garmin ever rated. */
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
    // `peaking` has no separate slot and folds into `fresh`.
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
