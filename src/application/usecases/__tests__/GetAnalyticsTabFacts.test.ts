import { describe, expect, it } from 'vitest'
import { analyticsTabFacts, type AnalyticsTabInputs } from '../GetAnalyticsTabFacts'
import type { AnalyticsPageData, WeeklyTrendPoint } from '../GetAnalyticsData'
import type { TrainingStatus } from '../GetTrainingStatus'

const EMPTY_TOTALS = {
  distanceKm: 0,
  durationSeconds: 0,
  sessionCount: 0,
  elevationM: 0,
  avgKmPerWeek: 0,
  calories: 0,
  caloriesPerWeek: 0,
}

const EMPTY_SERIES = {
  monthlyVolume: [],
  longRuns: [],
  easyHardSplit: [],
  distanceDistribution: [],
  typesPresent: [],
}

const emptyData: AnalyticsPageData = {
  years: [],
  byYear: {},
  weeklyTrends: [],
  efficiencyDaily: [],
  runningDynamicsDaily: [],
  allTime: { ...EMPTY_SERIES, totals: EMPTY_TOTALS },
}

const emptyInputs: AnalyticsTabInputs = {
  data: emptyData,
  status: null,
  load: null,
  loadRisk: null,
  loadBalance: null,
  threshold: null,
  racePredictions: null,
  vo2max: null,
}

function week(over: Partial<WeeklyTrendPoint>): WeeklyTrendPoint {
  return {
    date: '2026-01-05',
    label: 'W1',
    distanceKm: 0,
    sessionCount: 0,
    easyPace: null,
    hardPace: null,
    ef: null,
    efAdjusted: null,
    apparentTempC: null,
    easyAvgHr: null,
    hardAvgHr: null,
    cadenceSpm: null,
    groundContactMs: null,
    verticalOscillationMm: null,
    verticalRatioPct: null,
    strideLengthM: null,
    avgRpe: null,
    aer: null,
    ana: null,
    zoneSeconds: {},
    ...over,
  }
}

describe('analyticsTabFacts', () => {
  it('reports nothing to say rather than a thin prompt, so no quota is spent', () => {
    const facts = analyticsTabFacts(emptyInputs)
    expect(facts.fitness).toEqual([])
    expect(facts.performance).toEqual([])
    expect(facts.health).toEqual([])
  })

  it('states the load numbers behind the fitness tab', () => {
    const facts = analyticsTabFacts({
      ...emptyInputs,
      load: { points: [], ctl: 62.4, atl: 71.2, tsb: -8.8, tsbNow: -8.8 },
      status: { status: 'productive', loadTrend: 'building', risk: 'low', ctlDelta: 3.2, atlDelta: 5.1 } as TrainingStatus,
    })

    expect(facts.fitness[0]).toContain('62')
    expect(facts.fitness[1]).toContain('productive')
    expect(facts.fitness[2]).toContain('+3')
  })

  it('needs a few weeks before it calls a pace a trend', () => {
    const shortSeries = analyticsTabFacts({
      ...emptyInputs,
      data: { ...emptyData, weeklyTrends: [week({ easyPace: 330 }), week({ easyPace: 320 })] },
    })
    expect(shortSeries.performance).toEqual([])

    const longSeries = analyticsTabFacts({
      ...emptyInputs,
      data: {
        ...emptyData,
        weeklyTrends: [330, 328, 324, 320].map((easyPace) => week({ easyPace })),
      },
    })
    expect(longSeries.performance[0]).toContain('Easy pace')
  })

  it('always has the all-time volume to fall back on', () => {
    expect(analyticsTabFacts(emptyInputs).volume).toHaveLength(1)
  })
})
