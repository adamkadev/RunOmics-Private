import { describe, it, expect } from 'vitest'
import { getSeasonHeadline } from '../GetSeasonHeadline'
import type { AnalyticsPageData, WeeklyTrendPoint, YearAnalytics } from '../GetAnalyticsData'
import type { YearComparisonData, YearMetrics } from '../GetYearComparison'

function week(index: number, values: Partial<WeeklyTrendPoint>): WeeklyTrendPoint {
  // Consecutive Mondays in 2024, so every point falls in the current season.
  const monday = new Date(Date.UTC(2024, 0, 1 + index * 7)).toISOString().slice(0, 10)
  return {
    date: monday,
    label: `W${index + 1}`,
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
    ...values,
  }
}

const efWeeks = (values: (number | null)[]): WeeklyTrendPoint[] => values.map((ef, i) => week(i, { ef }))
const paceWeeks = (values: (number | null)[]): WeeklyTrendPoint[] => values.map((easyPace, i) => week(i, { easyPace }))
const block = (value: number): number[] => [value, value, value, value]

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
    const weeks = [
      ...efWeeks([...block(2.0), ...block(2.01)]),
      ...paceWeeks([...block(300), ...block(302)]),
    ]
    expect(getSeasonHeadline(pageData([2024], weeks), null)).toBeNull()
  })

  it('adds a positive efficiency bullet when it improves past the threshold', () => {
    const result = getSeasonHeadline(pageData([2024], efWeeks([...block(2.0), null, ...block(2.2)])), null)
    expect(result?.bullets).toHaveLength(1)
    expect(result?.bullets[0]?.tone).toBe('positive')
    expect(result?.title).toBe('Fitter and more efficient than early season.')
  })

  it('adds a caution pace bullet when easy pace slows down', () => {
    const result = getSeasonHeadline(pageData([2024], paceWeeks([...block(300), ...block(320)])), null)
    expect(result?.bullets).toEqual([
      { tone: 'caution', text: "Easy pace 5:20 /km, against 5:00 averaged over the season's first 4 weeks" },
    ])
    expect(result?.title).toBe('A tougher stretch than early season.')
  })

  it('says the early-season pace is a block average, not a run', () => {
    const result = getSeasonHeadline(pageData([2024], paceWeeks([...block(372), ...block(330)])), null)
    expect(result?.bullets).toEqual([
      { tone: 'positive', text: "Easy pace 5:30 /km, against 6:12 averaged over the season's first 4 weeks" },
    ])
  })

  it('reads blocks of weeks, so one outlier week does not become a headline', () => {
    // A single 8:00/km recovery jog in week 1 must not read as a 3min/km gain.
    const weeks = paceWeeks([480, ...block(300).slice(1), ...block(300)])
    expect(getSeasonHeadline(pageData([2024], weeks), null)).toBeNull()
  })

  it('returns null before there are two full blocks of weeks to compare', () => {
    const weeks = paceWeeks([...block(360), 300, 300, 300])
    expect(getSeasonHeadline(pageData([2024], weeks), null)).toBeNull()
  })

  it('mixes tones when metrics disagree', () => {
    const weeks = [
      ...block(0).map((_, i) => week(i, { ef: 2.0, easyPace: 300 })),
      ...block(0).map((_, i) => week(i + 4, { ef: 2.2, easyPace: 320 })),
    ]
    const result = getSeasonHeadline(pageData([2024], weeks), null)
    expect(result?.bullets).toHaveLength(2)
    expect(result?.title).toBe('A mixed season - gains in some areas, dips in others.')
  })

  it('ignores weeks outside the current season', () => {
    // Last season's weeks must not become the "early season" baseline.
    const weeks = [
      ...efWeeks(block(1.0)).map((w) => ({ ...w, date: w.date.replace('2024', '2023') })),
      ...efWeeks([...block(2.0), ...block(2.01)]),
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
