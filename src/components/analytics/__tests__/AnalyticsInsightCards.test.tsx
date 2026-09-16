import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalyticsInsightCards } from '@/components/analytics/AnalyticsInsightCards'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { VO2maxSeries } from '@/application/usecases/GetVO2maxHistory'
import type { ThresholdHistoryData } from '@/application/usecases/GetThresholdHistory'
import { MINUS, formatCompactMonthYear } from '@/lib/formatters'
import { t } from '@/i18n'

const s = t.analytics.insightCards

function week(date: string, easyPace: number | null): WeeklyTrendPoint {
  return {
    date,
    label: date,
    distanceKm: 40,
    sessionCount: 4,
    easyPace,
    hardPace: null,
    ef: 2,
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
  }
}

// Easy pace goes 6:00 -> 5:00 /km, so the delta against the first week is
// exactly -60 s and must print as -1:00, never as a bare "60 s".
const WEEKLY: WeeklyTrendPoint[] = [week('2025-05-19', 360), week('2025-11-17', 340), week('2026-09-14', 300)]

// Threshold goes 5:21 -> 4:25 /km: -56 s against the first reading.
const THRESHOLD: ThresholdHistoryData = {
  points: [
    { date: '2025-05-13', label: '13 May', lthrBpm: 170, thresholdPaceSecPerKm: 321 },
    { date: '2026-09-15', label: '15 Sep', lthrBpm: 172, thresholdPaceSecPerKm: 265 },
  ],
  latestLthr: 172,
  latestPace: 265,
  paceGainSec: 56,
}

const VO2: VO2maxSeries = {
  '4w': [],
  '6m': [],
  '1y': [
    { date: '2025-10-15', label: 'Oct 25', value: 53.2 },
    { date: '2026-09-15', label: 'Sep 26', value: 54.5 },
  ],
}

function renderCards(overrides: Partial<Parameters<typeof AnalyticsInsightCards>[0]> = {}) {
  return render(
    <AnalyticsInsightCards
      vo2maxSeries={VO2}
      vo2maxTopPercent={6}
      weeklyTrends={WEEKLY}
      threshold={THRESHOLD}
      activeDays={206}
      heatmapDays={367}
      {...overrides}
    />
  )
}

describe('Analytics insight chips carry numbers', () => {
  it('states the consistency share off the heatmap window instead of a judgement', () => {
    renderCards()

    // 206 of 367 days is 56%. The old chip said "excellent" and could not move.
    expect(screen.getByText(`56${t.units.percent}`)).toBeTruthy()
    expect(screen.getByText(s.ofDays('367'))).toBeTruthy()
    expect(screen.getByText('206')).toBeTruthy()
    expect(screen.getByText(s.days)).toBeTruthy()
  })

  it('prints both pace deltas as signed m:ss and names the month they are measured from', () => {
    renderCards()

    // No unit on the chip: the value it sits on already carries "/km".
    expect(screen.getByText(`${MINUS}1:00`)).toBeTruthy()
    expect(screen.getByText(`${MINUS}0:56`)).toBeTruthy()

    // Both baselines are May 2025, so the label appears once per pace tile.
    expect(screen.getAllByText(s.since(formatCompactMonthYear('2025-05-13')))).toHaveLength(2)
  })

  it('leaves no chip at all when a series has only one reading', () => {
    renderCards({
      weeklyTrends: [week('2026-09-14', 300)],
      threshold: {
        points: [{ date: '2026-09-15', label: '15 Sep', lthrBpm: 172, thresholdPaceSecPerKm: 265 }],
        latestLthr: 172,
        latestPace: 265,
        paceGainSec: null,
      },
    })

    // A delta needs something to be a delta from; nothing is better than a word.
    expect(screen.queryByText(/^[+−]\d/)).toBeNull()
    expect(screen.getByText('5:00')).toBeTruthy()
    expect(screen.getByText('4:25')).toBeTruthy()
  })

  it('shows VO₂max at one decimal, matching the Progress tab', () => {
    renderCards()
    expect(screen.getByText('54.5')).toBeTruthy()
    expect(screen.getByText(s.topPercent(6))).toBeTruthy()
  })
})
