import { describe, it, expect } from 'vitest'
import {
  weightedAvg,
  avgField,
  easyHardShare,
  efficiencyFactor,
  zoneDistribution,
  distanceDistribution,
  computeTotals,
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

// ---------- weightedAvg ----------

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

// ---------- avgField ----------

describe('avgField', () => {
  it('returns null when no activity has the field set', () => {
    expect(avgField([act({ rpe: null })], (a) => a.rpe)).toBeNull()
  })

  it('averages only non-null values', () => {
    const acts = [act({ rpe: 4 }), act({ rpe: null }), act({ rpe: 6 })]
    expect(avgField(acts, (a) => a.rpe)).toBe(5)
  })
})

// ---------- easyHardShare ----------

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

// ---------- efficiencyFactor ----------

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

// ---------- zoneDistribution ----------

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

// ---------- distanceDistribution ----------

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

// ---------- computeTotals ----------

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
