import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Vo2maxSample } from '@/infrastructure/repositories/JsonVo2maxHistoryRepository'
import type { Activity } from '@/domain/activity/types'

const samples = vi.hoisted(() => ({ months: [] as Vo2maxSample[], days: [] as Vo2maxSample[] }))
const activities = vi.hoisted(() => ({ all: [] as Activity[] }))

vi.mock('@/infrastructure/repositories/JsonVo2maxHistoryRepository', () => ({
  getVo2maxSamples: () => samples,
}))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({
  getAllActivities: () => activities.all,
}))

const { getVO2maxSeries } = await import('../GetVO2maxHistory')

const day = (date: string, vo2max: number): Vo2maxSample => ({ date, vo2max })

// 14 monthly samples, 2025-06 (50) through 2026-07 (63).
const month = (i: number): Vo2maxSample => {
  const m = 5 + i
  const date = `${2025 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-28`
  return { date, vo2max: 50 + i }
}

beforeEach(() => {
  samples.months = Array.from({ length: 14 }, (_, i) => month(i))
  samples.days = []
  activities.all = []
})

describe('getVO2maxSeries', () => {
  it('caps the long windows at 6 and 12 monthly points', () => {
    const series = getVO2maxSeries()
    expect(series['6m']).toHaveLength(6)
    expect(series['1y']).toHaveLength(12)
  })

  it('keeps the most recent months, not the oldest', () => {
    const series = getVO2maxSeries()
    expect(series['6m'][5]!.value).toBe(63)
    expect(series['6m'][0]!.value).toBe(58)
  })

  it('plots one point per day over the four-week window', () => {
    samples.days = [
      day('2026-06-01', 55), // 40+ days before the latest sample
      day('2026-07-05', 56),
      day('2026-07-12', 56.4),
      day('2026-07-16', 55.8),
    ]
    expect(getVO2maxSeries()['4w'].map((p) => p.value)).toEqual([56, 56.4, 55.8])
  })

  it('is empty rather than wrong when nothing has been synced', () => {
    samples.months = []
    expect(getVO2maxSeries()['4w']).toEqual([])
    expect(getVO2maxSeries()['1y']).toEqual([])
  })

  it('falls back to the per-activity readings until the sync has run', () => {
    samples.months = []
    activities.all = [
      { date: '2026-06-10', vo2maxGarmin: 56 },
      { date: '2026-06-28', vo2maxGarmin: 57 },
      { date: '2026-07-16', vo2maxGarmin: 56 },
    ] as Activity[]

    // One point per month for the long view, the last reading of each.
    expect(getVO2maxSeries()['1y'].map((p) => p.value)).toEqual([57, 56])
    expect(getVO2maxSeries()['4w'].map((p) => p.date)).toEqual(['2026-06-28', '2026-07-16'])
  })
})
