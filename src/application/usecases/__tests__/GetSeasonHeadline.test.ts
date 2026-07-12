import { describe, it, expect } from 'vitest'
import { getSeasonHeadline } from '../GetSeasonHeadline'
import type { AnalyticsPageData, MonthlyEfficiency, MonthlyPace, YearAnalytics } from '../GetAnalyticsData'
import type { YearComparisonData, YearMetrics } from '../GetYearComparison'

function efficiencyTrend(values: (number | null)[]): MonthlyEfficiency[] {
  return values.map((ef, i) => ({ month: `2024-${i + 1}`, label: `M${i + 1}`, ef }))
}

function paceTrend(values: (number | null)[]): MonthlyPace[] {
  return values.map((easyPace, i) => ({ month: `2024-${i + 1}`, label: `M${i + 1}`, easyPace, hardPace: null }))
}

function season(overrides: Partial<YearAnalytics> = {}): YearAnalytics {
  return {
    year: 2024,
    totals: { distanceKm: 0, durationSeconds: 0, sessionCount: 0, elevationM: 0, avgKmPerWeek: 0, calories: 0, caloriesPerWeek: 0 },
    monthlyVolume: [],
    paceTrend: [],
    efficiencyTrend: [],
    hrTrend: [],
    cadenceTrend: [],
    runningFormTrend: [],
    longRuns: [],
    easyHardSplit: [],
    zoneDistribution: [],
    distanceDistribution: [],
    rpeTrend: [],
    trainingEffectTrend: [],
    typesPresent: [],
    ...overrides,
  }
}

function pageData(byYear: Record<number, YearAnalytics>): AnalyticsPageData {
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)
  return {
    years,
    byYear,
    periodWeeks: [8, 12, 16],
    byPeriod: {},
    efficiencyDaily: [],
    runningDynamicsDaily: [],
    allTime: { ...season(), totals: season().totals },
  }
}

function yearMetrics(year: number, avgKmPerWeek: number): YearMetrics {
  return { year, distanceKm: 0, sessionCount: 0, durationSeconds: 0, avgKmPerWeek, avgPaceSecPerKm: null, avgHeartRate: null, elevationM: 0 }
}

describe('getSeasonHeadline', () => {
  it('returns null when there is no season data', () => {
    expect(getSeasonHeadline(pageData({}), null)).toBeNull()
  })

  it('returns null when no metric crosses its signal threshold', () => {
    const data = pageData({
      2024: season({ efficiencyTrend: efficiencyTrend([2.0, 2.01]), paceTrend: paceTrend([300, 302]) }),
    })
    expect(getSeasonHeadline(data, null)).toBeNull()
  })

  it('adds a positive efficiency bullet when it improves past the threshold', () => {
    const data = pageData({
      2024: season({ efficiencyTrend: efficiencyTrend([2.0, null, 2.2]) }),
    })
    const result = getSeasonHeadline(data, null)
    expect(result?.bullets).toHaveLength(1)
    expect(result?.bullets[0]?.tone).toBe('positive')
    expect(result?.title).toBe('Fitter and more efficient than early season.')
  })

  it('adds a caution pace bullet when easy pace slows down', () => {
    const data = pageData({
      2024: season({ paceTrend: paceTrend([300, 320]) }),
    })
    const result = getSeasonHeadline(data, null)
    expect(result?.bullets).toHaveLength(1)
    expect(result?.bullets[0]?.tone).toBe('caution')
    expect(result?.title).toBe('A tougher stretch than early season.')
  })

  it('mixes tones when metrics disagree', () => {
    const data = pageData({
      2024: season({ efficiencyTrend: efficiencyTrend([2.0, 2.2]), paceTrend: paceTrend([300, 320]) }),
    })
    const result = getSeasonHeadline(data, null)
    expect(result?.bullets).toHaveLength(2)
    expect(result?.title).toBe('A mixed season - gains in some areas, dips in others.')
  })

  it('adds a volume bullet only when the comparison matches the current season', () => {
    const comparison: YearComparisonData = {
      years: [2024, 2023],
      newer: yearMetrics(2024, 38),
      older: yearMetrics(2023, 50),
    }
    const data = pageData({ 2024: season() })
    const result = getSeasonHeadline(data, comparison)
    expect(result?.bullets).toEqual([
      { tone: 'caution', text: 'Volume down 24% vs 2023 - watch consistency' },
    ])
  })

  it('ignores the comparison when it does not cover the current season', () => {
    const comparison: YearComparisonData = {
      years: [2023, 2022],
      newer: yearMetrics(2023, 38),
      older: yearMetrics(2022, 50),
    }
    const data = pageData({ 2024: season() })
    expect(getSeasonHeadline(data, comparison)).toBeNull()
  })
})
