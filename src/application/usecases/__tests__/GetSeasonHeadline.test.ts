import { describe, it, expect } from 'vitest'
import { getSeasonHeadline } from '../GetSeasonHeadline'
import type { AnalyticsPageData, WeeklyTrendPoint, YearAnalytics } from '../GetAnalyticsData'
import type { YearComparisonData, YearMetrics } from '../GetYearComparison'

function week(index: number, values: Partial<WeeklyTrendPoint>): WeeklyTrendPoint {
  // Consecutive Mondays in 2024, so every point falls in the current season.
  const day = String(1 + index * 7).padStart(2, '0')
  return {
    date: `2024-01-${day}`,
    label: `W${index + 1}`,
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
    ...values,
  }
}

const efWeeks = (values: (number | null)[]): WeeklyTrendPoint[] => values.map((ef, i) => week(i, { ef }))
const paceWeeks = (values: (number | null)[]): WeeklyTrendPoint[] => values.map((easyPace, i) => week(i, { easyPace }))

function season(): YearAnalytics {
  return {
    year: 2024,
    totals: { distanceKm: 0, durationSeconds: 0, sessionCount: 0, elevationM: 0, avgKmPerWeek: 0, calories: 0, caloriesPerWeek: 0 },
    monthlyVolume: [],
    longRuns: [],
    easyHardSplit: [],
    distanceDistribution: [],
    typesPresent: [],
  }
}

function pageData(years: number[], weeklyTrends: WeeklyTrendPoint[] = []): AnalyticsPageData {
  return {
    years,
    byYear: Object.fromEntries(years.map((y) => [y, { ...season(), year: y }])),
    weeklyTrends,
    efficiencyDaily: [],
    runningDynamicsDaily: [],
    allTime: season(),
  }
}

function yearMetrics(year: number, avgKmPerWeek: number): YearMetrics {
  return { year, distanceKm: 0, sessionCount: 0, durationSeconds: 0, avgKmPerWeek, avgPaceSecPerKm: null, avgHeartRate: null, elevationM: 0 }
}

describe('getSeasonHeadline', () => {
  it('returns null when there is no season data', () => {
    expect(getSeasonHeadline(pageData([]), null)).toBeNull()
  })

  it('returns null when no metric crosses its signal threshold', () => {
    const weeks = [...efWeeks([2.0, 2.01]), ...paceWeeks([300, 302])]
    expect(getSeasonHeadline(pageData([2024], weeks), null)).toBeNull()
  })

  it('adds a positive efficiency bullet when it improves past the threshold', () => {
    const result = getSeasonHeadline(pageData([2024], efWeeks([2.0, null, 2.2])), null)
    expect(result?.bullets).toHaveLength(1)
    expect(result?.bullets[0]?.tone).toBe('positive')
    expect(result?.title).toBe('Fitter and more efficient than early season.')
  })

  it('adds a caution pace bullet when easy pace slows down', () => {
    const result = getSeasonHeadline(pageData([2024], paceWeeks([300, 320])), null)
    expect(result?.bullets).toHaveLength(1)
    expect(result?.bullets[0]?.tone).toBe('caution')
    expect(result?.title).toBe('A tougher stretch than early season.')
  })

  it('mixes tones when metrics disagree', () => {
    const weeks = [
      week(0, { ef: 2.0, easyPace: 300 }),
      week(1, { ef: 2.2, easyPace: 320 }),
    ]
    const result = getSeasonHeadline(pageData([2024], weeks), null)
    expect(result?.bullets).toHaveLength(2)
    expect(result?.title).toBe('A mixed season - gains in some areas, dips in others.')
  })

  it('ignores weeks outside the current season', () => {
    // Last season's weeks must not become the "early season" baseline.
    const weeks = [
      { ...week(0, { ef: 1.0 }), date: '2023-06-05' },
      ...efWeeks([2.0, 2.01]),
    ]
    expect(getSeasonHeadline(pageData([2024, 2023], weeks), null)).toBeNull()
  })

  it('adds a volume bullet only when the comparison matches the current season', () => {
    const comparison: YearComparisonData = {
      years: [2024, 2023],
      newer: yearMetrics(2024, 38),
      older: yearMetrics(2023, 50),
    }
    const result = getSeasonHeadline(pageData([2024]), comparison)
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
    expect(getSeasonHeadline(pageData([2024]), comparison)).toBeNull()
  })
})
