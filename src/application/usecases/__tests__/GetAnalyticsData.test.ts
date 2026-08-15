import { describe, it, expect } from 'vitest'
import {
  weightedAvg,
  avgField,
  easyHardShare,
  efficiencyFactor,
  adjustedEfficiencyFactor,
  zoneDistribution,
  distanceDistribution,
  computeTotals,
  buildWeeklyTrends,
} from '../GetAnalyticsData'
import type { Activity, HrZone } from '@/domain/activity/types'

const act = (overrides: Partial<Activity> = {}): Activity =>
  ({
    date: '2024-06-01',
    distanceKm: 0,
    durationSeconds: 0,
    paceSecPerKm: null,
    avgHeartRate: null,
    elevationGain: null,
    calories: null,
    hrZones: [],
    ...overrides,
  }) as Activity

const zone = (zoneNum: number, seconds: number): HrZone =>
  ({ zone: zoneNum, seconds, percent: 0, minBpm: 0, maxBpm: null }) as HrZone

describe('weightedAvg', () => {
  it('returns null when no value is present', () => {
    const acts = [act({ paceSecPerKm: null, distanceKm: 10 })]
    expect(weightedAvg(acts, (a) => a.paceSecPerKm, (a) => a.distanceKm)).toBeNull()
  })

  it('skips entries with non-positive weight', () => {
    const acts = [act({ paceSecPerKm: 300, distanceKm: 0 }), act({ paceSecPerKm: 360, distanceKm: 10 })]
    expect(weightedAvg(acts, (a) => a.paceSecPerKm, (a) => a.distanceKm, 0)).toBe(360)
  })

  it('weights the average by the given weight function', () => {
    const acts = [act({ paceSecPerKm: 200, distanceKm: 1 }), act({ paceSecPerKm: 400, distanceKm: 3 })]
    // (200*1 + 400*3) / 4 = 350
    expect(weightedAvg(acts, (a) => a.paceSecPerKm, (a) => a.distanceKm, 0)).toBe(350)
  })

  it('rounds to the given number of decimals', () => {
    const acts = [act({ paceSecPerKm: 100, distanceKm: 1 }), act({ paceSecPerKm: 101, distanceKm: 1 })]
    expect(weightedAvg(acts, (a) => a.paceSecPerKm, (a) => a.distanceKm, 0)).toBe(101)
  })
})

describe('avgField', () => {
  it('returns null when no activity has the field set', () => {
    expect(avgField([act({ rpe: null })], (a) => a.rpe)).toBeNull()
  })

  it('averages only non-null values', () => {
    const acts = [act({ rpe: 4 }), act({ rpe: null }), act({ rpe: 6 })]
    expect(avgField(acts, (a) => a.rpe)).toBe(5)
  })
})

describe('easyHardShare', () => {
  it('returns nulls when there is no zone data', () => {
    expect(easyHardShare([act({ hrZones: [] })])).toEqual({ easyPct: null, hardPct: null })
  })

  it('classifies zones 1-2 as easy, 3+ as hard', () => {
    const acts = [act({ hrZones: [zone(1, 600), zone(2, 600), zone(3, 800)] })]
    // easy = 1200, total = 2000 → 60%
    expect(easyHardShare(acts)).toEqual({ easyPct: 60, hardPct: 40 })
  })

  it('aggregates zones across multiple activities', () => {
    const acts = [act({ hrZones: [zone(1, 1000)] }), act({ hrZones: [zone(4, 1000)] })]
    expect(easyHardShare(acts)).toEqual({ easyPct: 50, hardPct: 50 })
  })
})

describe('efficiencyFactor', () => {
  it('returns null when no activity qualifies (needs pace, HR and >= 3km)', () => {
    expect(efficiencyFactor([act({ paceSecPerKm: 300, avgHeartRate: 140, distanceKm: 2 })])).toBeNull()
  })

  it('computes (speed in m/min) / HR averaged across qualifying activities', () => {
    // pace 300 s/km → speed = 1000/300 * 60 = 200 m/min; ef = 200/140 ≈ 1.43
    const acts = [act({ paceSecPerKm: 300, avgHeartRate: 140, distanceKm: 5 })]
    expect(efficiencyFactor(acts)).toBeCloseTo(1.43, 2)
  })

  it('ignores activities below the 3km threshold', () => {
    const acts = [
      act({ paceSecPerKm: 300, avgHeartRate: 140, distanceKm: 5 }),
      act({ paceSecPerKm: 600, avgHeartRate: 100, distanceKm: 1 }),
    ]
    expect(efficiencyFactor(acts)).toBeCloseTo(1.43, 2)
  })
})

describe('adjustedEfficiencyFactor', () => {
  const weather = (apparentTempC: number) =>
    ({ tempC: apparentTempC, apparentTempC, humidityPct: 60, windKph: 5, windDirDeg: 180, precipitationMm: 0, code: 0 })

  it('matches the raw factor when every run was cool', () => {
    const acts = [act({ paceSecPerKm: 300, avgHeartRate: 140, distanceKm: 5, weather: weather(10) })]
    expect(adjustedEfficiencyFactor(acts)).toBeCloseTo(efficiencyFactor(acts)!, 2)
  })

  it('lifts a hot run above its measured value', () => {
    const acts = [act({ paceSecPerKm: 300, avgHeartRate: 140, distanceKm: 5, weather: weather(25) })]
    expect(adjustedEfficiencyFactor(acts)).toBeCloseTo(1.5, 2)
  })

  it('leaves runs without weather at their measured value', () => {
    const acts = [act({ paceSecPerKm: 300, avgHeartRate: 140, distanceKm: 5, weather: null })]
    expect(adjustedEfficiencyFactor(acts)).toBeCloseTo(1.43, 2)
  })
})

describe('zoneDistribution', () => {
  it('returns an empty array when there is no zone data', () => {
    expect(zoneDistribution([act({ hrZones: [] })])).toEqual([])
  })

  it('aggregates seconds per zone and computes percent share, sorted by zone', () => {
    const acts = [act({ hrZones: [zone(2, 300), zone(1, 700)] })]
    const result = zoneDistribution(acts)
    expect(result.map((z) => z.zone)).toEqual([1, 2])
    expect(result[0]).toEqual({ zone: 1, seconds: 700, percent: 70 })
    expect(result[1]).toEqual({ zone: 2, seconds: 300, percent: 30 })
  })
})

describe('distanceDistribution', () => {
  it('buckets activities into distance brackets and drops empty brackets', () => {
    const acts = [act({ distanceKm: 3 }), act({ distanceKm: 8 }), act({ distanceKm: 8 })]
    const result = distanceDistribution(acts)
    expect(result).toEqual([
      { label: '< 5 km', count: 1, km: 3 },
      { label: '5–10 km', count: 2, km: 16 },
    ])
  })

  it('treats the bracket upper bound as exclusive and the marathon+ bracket as open-ended', () => {
    const acts = [act({ distanceKm: 5 }), act({ distanceKm: 50 })]
    const result = distanceDistribution(acts)
    expect(result.find((b) => b.label === '5–10 km')?.count).toBe(1)
    expect(result.find((b) => b.label === '42+ km')?.count).toBe(1)
  })
})

describe('buildWeeklyTrends', () => {
  it('groups activities into ISO weeks keyed on the Monday, oldest first', () => {
    // 2024-06-01 is a Saturday (week of Mon 27 May); 2024-06-05 a Wednesday.
    const points = buildWeeklyTrends([
      act({ date: '2024-06-05', type: 'Base' }),
      act({ date: '2024-06-01', type: 'Base' }),
    ])

    expect(points.map((p) => p.date)).toEqual(['2024-05-27', '2024-06-03'])
  })

  it('puts every activity of the same week in one point', () => {
    const points = buildWeeklyTrends([
      act({ date: '2024-06-03', type: 'Base', avgHeartRate: 140, durationSeconds: 600 }),
      act({ date: '2024-06-06', type: 'Base', avgHeartRate: 160, durationSeconds: 600 }),
    ])

    expect(points).toHaveLength(1)
    expect(points[0]?.easyAvgHr).toBe(150)
  })

  it('sums HR zone seconds per week for the zone pie', () => {
    const points = buildWeeklyTrends([
      act({ date: '2024-06-03', hrZones: [zone(1, 300), zone(2, 200)] }),
      act({ date: '2024-06-04', hrZones: [zone(1, 100)] }),
    ])

    expect(points[0]?.zoneSeconds).toEqual({ 1: 400, 2: 200 })
  })

  it('skips weeks with no activity rather than padding them with nulls', () => {
    const points = buildWeeklyTrends([
      act({ date: '2024-06-03' }),
      act({ date: '2024-07-01' }),
    ])

    expect(points.map((p) => p.date)).toEqual(['2024-06-03', '2024-07-01'])
  })

  it('splits easy from hard runs when averaging pace', () => {
    const points = buildWeeklyTrends([
      act({ date: '2024-06-03', type: 'Base', paceSecPerKm: 360, distanceKm: 10 }),
      act({ date: '2024-06-04', type: 'Threshold', paceSecPerKm: 240, distanceKm: 10 }),
    ])

    expect(points[0]?.easyPace).toBe(360)
    expect(points[0]?.hardPace).toBe(240)
  })

  // Summed, unlike every other read on the point, which are averages: the
  // weekly volume chart plots these as the week's actual total.
  it('sums the distance and session count of the week', () => {
    const points = buildWeeklyTrends([
      act({ date: '2024-06-03', distanceKm: 10.4 }),
      act({ date: '2024-06-06', distanceKm: 8.2 }),
      act({ date: '2024-06-10', distanceKm: 5 }),
    ])

    expect(points[0]?.distanceKm).toBe(19)
    expect(points[0]?.sessionCount).toBe(2)
    expect(points[1]?.distanceKm).toBe(5)
    expect(points[1]?.sessionCount).toBe(1)
  })

  it('is empty when there are no activities', () => {
    expect(buildWeeklyTrends([])).toEqual([])
  })
})

describe('computeTotals', () => {
  it('sums distance, duration, elevation and calories', () => {
    const acts = [
      act({ distanceKm: 10, durationSeconds: 3000, elevationGain: 50, calories: 600 }),
      act({ distanceKm: 5, durationSeconds: 1500, elevationGain: null, calories: null }),
    ]
    const totals = computeTotals(acts, 7)
    expect(totals.distanceKm).toBe(15)
    expect(totals.durationSeconds).toBe(4500)
    expect(totals.sessionCount).toBe(2)
    expect(totals.elevationM).toBe(50)
    expect(totals.calories).toBe(600)
  })

  it('extrapolates avgKmPerWeek and caloriesPerWeek from elapsed days', () => {
    // 14km over 7 elapsed days → 14 km/week
    const totals = computeTotals([act({ distanceKm: 14, calories: 700 })], 7)
    expect(totals.avgKmPerWeek).toBe(14)
    expect(totals.caloriesPerWeek).toBe(700)
  })

  it('clamps elapsedDays to a minimum of 1 to avoid division by zero', () => {
    const totals = computeTotals([act({ distanceKm: 2 })], 0)
    expect(totals.avgKmPerWeek).toBe(14)
  })
})
