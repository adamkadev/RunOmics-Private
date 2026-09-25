import { describe, it, expect, vi, beforeEach } from 'vitest'
import { avgWeightedPace, avgWeightedHR, buildMetrics } from '../GetYearComparison'
import type { Activity } from '@/domain/activity/types'

const act = (overrides: Partial<Activity> = {}): Activity =>
  ({
    week: 1,
    date: '2024-06-01',
    distanceKm: 0,
    durationSeconds: 0,
    paceSecPerKm: null,
    avgHeartRate: null,
    elevationGain: null,
    ...overrides,
  }) as Activity

describe('avgWeightedPace', () => {
  it('returns null when no activity has a pace', () => {
    expect(avgWeightedPace([act({ paceSecPerKm: null, distanceKm: 10 })])).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(avgWeightedPace([])).toBeNull()
  })

  it('ignores activities with zero distance', () => {
    expect(avgWeightedPace([act({ paceSecPerKm: 300, distanceKm: 0 })])).toBeNull()
  })

  it('weights pace by distance', () => {
    const acts = [act({ paceSecPerKm: 300, distanceKm: 10 }), act({ paceSecPerKm: 360, distanceKm: 5 })]
    expect(avgWeightedPace(acts)).toBe(320)
  })
})

describe('avgWeightedHR', () => {
  it('returns null when no activity has HR', () => {
    expect(avgWeightedHR([act({ avgHeartRate: null, durationSeconds: 1800 })])).toBeNull()
  })

  it('returns null when duration is zero', () => {
    expect(avgWeightedHR([act({ avgHeartRate: 150, durationSeconds: 0 })])).toBeNull()
  })

  it('weights HR by duration', () => {
    const acts = [act({ avgHeartRate: 140, durationSeconds: 3600 }), act({ avgHeartRate: 160, durationSeconds: 1800 })]
    expect(avgWeightedHR(acts)).toBe(147)
  })
})

describe('buildMetrics', () => {
  it('sums distance, duration, elevation and counts sessions', () => {
    const acts = [
      act({ week: 1, distanceKm: 10, durationSeconds: 3000, elevationGain: 50 }),
      act({ week: 2, distanceKm: 5, durationSeconds: 1500, elevationGain: 20 }),
    ]
    const metrics = buildMetrics(2024, acts)
    expect(metrics.year).toBe(2024)
    expect(metrics.distanceKm).toBe(15)
    expect(metrics.sessionCount).toBe(2)
    expect(metrics.durationSeconds).toBe(4500)
    expect(metrics.elevationM).toBe(70)
  })

  it('treats missing elevation as 0', () => {
    const metrics = buildMetrics(2024, [act({ elevationGain: null })])
    expect(metrics.elevationM).toBe(0)
  })

  // G03: per week since the first run, empty weeks included - not only over
  // the weeks that had a run.
  it('computes avgKmPerWeek per week since the first run, to the cut-off', () => {
    const acts = [
      act({ date: '2024-06-03', distanceKm: 10 }),
      act({ date: '2024-06-04', distanceKm: 5 }),
      act({ date: '2024-06-24', distanceKm: 13 }),
    ]
    // 2024-06-03 to 2024-06-30 is 28 days, 4 weeks: 28 km / 4.
    expect(buildMetrics(2024, acts, '2024-06-30').avgKmPerWeek).toBe(7)
  })

  it('returns avgKmPerWeek of 0 for no activities', () => {
    expect(buildMetrics(2024, []).avgKmPerWeek).toBe(0)
    expect(buildMetrics(2024, []).avgPaceSecPerKm).toBeNull()
    expect(buildMetrics(2024, []).avgHeartRate).toBeNull()
  })
})

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({
  getAllActivities: vi.fn(),
}))

describe('getYearComparison', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns null with fewer than 2 distinct years', async () => {
    const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
    vi.mocked(getAllActivities).mockReturnValue([act({ date: '2024-06-01' })])

    const { getYearComparison } = await import('../GetYearComparison')
    expect(getYearComparison()).toBeNull()
  })

  it('compares the two most recent years, newer first', async () => {
    const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
    vi.mocked(getAllActivities).mockReturnValue([
      act({ date: '2024-03-01', distanceKm: 10, week: 1 }),
      act({ date: '2023-03-01', distanceKm: 20, week: 1 }),
      act({ date: '2022-03-01', distanceKm: 100, week: 1 }),
    ])

    const { getYearComparison } = await import('../GetYearComparison')
    const result = getYearComparison()
    expect(result?.years).toEqual([2024, 2023])
    expect(result?.newer.distanceKm).toBe(10)
    expect(result?.older.distanceKm).toBe(20)
  })
})

describe('getYearComparison', () => {
  beforeEach(() => vi.resetModules())

  // G03: 2026 so far was set against the whole of 2025.
  it('compares the current year to the same date last year', async () => {
    vi.doMock('@/infrastructure/repositories/JsonActivityRepository', () => ({
      getAllActivities: () => [
        act({ date: '2026-03-01', distanceKm: 100 }),
        act({ date: '2025-04-03', distanceKm: 60 }),
        act({ date: '2025-11-20', distanceKm: 500 }),
      ],
    }))
    const { getYearComparison } = await import('../GetYearComparison')
    const data = getYearComparison('2026-09-25')!
    expect(data.cutoff).toBe('2026-09-25')
    expect(data.newer.distanceKm).toBe(100)
    expect(data.older.distanceKm).toBe(60)
  })
})
