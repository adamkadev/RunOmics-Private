import { describe, expect, it } from 'vitest'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import { t } from '@/i18n'
import type { AnalyticsBoardData } from '../AnalyticsClient'
import type { WeekRow } from '../analyticsView'
import { intensityRead, volumeRead } from '../coachReadTabs'

const s = t.analytics.cards.coachRead

function point(km: number, longestKm: number, zones: Record<number, number> = { 2: 3600 }): WeeklyTrendPoint {
  return {
    date: '', label: '', distanceKm: km, sessionCount: 4, easyPace: 350, hardPace: 290, ef: null, efAdjusted: null, apparentTempC: null,
    easyAvgHr: null, hardAvgHr: null, cadenceSpm: null, groundContactMs: null, verticalOscillationMm: null, verticalRatioPct: null,
    strideLengthM: null, avgRpe: null, aer: null, ana: null, zoneSeconds: zones, longestKm, longestDate: null, durationSeconds: 3600,
    thresholdSessions: 0, intervalSessions: 0,
  } as WeeklyTrendPoint
}

/** Finished weeks of `km` against `planKm`, then the week under way. */
function rows(weeks: { km: number; planKm: number | null; longestKm: number; zones?: Record<number, number> }[]): WeekRow[] {
  return weeks.map((w, i) => ({ week: `2026-0${(i % 9) + 1}-01`, km: w.km, planKm: w.planKm, current: i === weeks.length - 1, point: point(w.km, w.longestKm, w.zones) }))
}

const data = { weeklyAvgKm: null, ytd: null, plan: [] } as unknown as AnalyticsBoardData

describe('the Volume read', () => {
  it('reads weeks on plan as good news', () => {
    const read = volumeRead(data, rows([...Array(4)].map(() => ({ km: 40, planKm: 40, longestKm: 12 })).concat({ km: 10, planKm: 40, longestKm: 10 })), true)!
    expect(read).toMatchObject({ tone: 'pos', headline: s.volumeTab.onPlan(4, 4) })
  })

  it('reads a plan mostly not run as a caution', () => {
    const read = volumeRead(data, rows([...Array(4)].map((_, i) => ({ km: i ? 20 : 40, planKm: 40, longestKm: 6 })).concat({ km: 0, planKm: 40, longestKm: 0 })), true)!
    expect(read).toMatchObject({ tone: 'warn', headline: s.volumeTab.underPlan(1, 4) })
  })

  // The week under way is never "over": its first runs are all of its distance so far.
  it('leads with a long run over 35% of its week when it is a pattern, not the week under way', () => {
    const read = volumeRead(data, rows([
      { km: 30, planKm: null, longestKm: 14 },
      { km: 30, planKm: null, longestKm: 14 },
      { km: 30, planKm: null, longestKm: 8 },
      { km: 10, planKm: null, longestKm: 10 },
    ]), true)!
    expect(read).toMatchObject({ tone: 'warn', headline: s.volumeTab.longRunOver(2, 3) })
    // Worse first: the long run, then the level average.
    expect(read.rows.map((r) => r.trend)).toEqual(['declining', 'flat'])
  })
})

describe('the Intensity read', () => {
  it('reads the one easy / moderate / hard verdict Analytics and Athlete share', () => {
    const tooModerate = intensityRead(data, rows([{ km: 30, planKm: null, longestKm: 10, zones: { 2: 7000, 3: 2000, 4: 1000 } }]))!
    expect(tooModerate).toMatchObject({ tone: 'warn', headline: s.intensityTab.tooModerate(20) })
    const inRange = intensityRead(data, rows([{ km: 30, planKm: null, longestKm: 10, zones: { 2: 9000, 3: 500, 4: 500 } }]))!
    expect(inRange).toMatchObject({ tone: 'pos', headline: s.intensityTab.inRange(90) })
    expect(inRange.rows[0]!.text).toBe(s.intensityTab.splitRow(90, 5, 5))
  })
})
