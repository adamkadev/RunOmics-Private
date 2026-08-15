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
    // 10km @ 300s/km + 5km @ 360s/km → (3000+1800)/15 = 320
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
    // 3600s @ 140 + 1800s @ 160 → (504000+288000)/5400 = 146.67 → rounds to 147
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

  it('computes avgKmPerWeek over distinct weeks with activity', () => {
    // 30km spread over 2 distinct weeks → 15/week
    const acts = [
      act({ week: 1, distanceKm: 10 }),
      act({ week: 1, distanceKm: 5 }),
      act({ week: 2, distanceKm: 15 }),
    ]
    expect(buildMetrics(2024, acts).avgKmPerWeek).toBe(15)
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
