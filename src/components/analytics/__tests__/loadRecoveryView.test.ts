import { describe, expect, it, vi } from 'vitest'
import { loadPairs, type LoadPair } from '@/domain/training/loadTrend'
import { addDays, isoDate } from '@/lib/calendarDate'
import { dayWindow } from '../analyticsView'
import {
  loadChange,
  loadCoachHeadline,
  loadTrendView,
  loadFocusView,
  loadTrendYMax,
  recoveryView,
  RECOVERY_MIN_DAYS,
  type LoadTrendView,
  type RecoveryView,
} from '../loadRecoveryView'
import type { LoadBalanceData } from '@/application/usecases/GetLoadBalance'

const TODAY = '2026-09-26'
const day = (i: number) => isoDate(addDays(new Date(`${TODAY}T00:00:00`), -i))

/** Status days as training_status.json stores them, newest last. */
const STATUS_DAYS = Array.from({ length: 400 }, (_, i) => ({
  date: day(399 - i),
  status: 'productive',
  acuteLoad: 280 + ((i * 7) % 60) + (i > 380 ? (i - 380) * 3 : 0),
  chronicLoad: 295 + (i % 5),
}))

vi.mock('@/infrastructure/repositories/JsonTrainingStatusRepository', () => ({
  getTrainingStatusDays: () => STATUS_DAYS,
  getLatestTrainingStatusDay: () => STATUS_DAYS.at(-1),
}))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({
  getAllActivities: () => [
    { id: '2', date: `${TODAY}T07:00:00`, distanceKm: 10, durationSeconds: 3000, avgHeartRate: 150 },
    { id: '1', date: `${day(399)}T07:00:00`, distanceKm: 10, durationSeconds: 3000, avgHeartRate: 150 },
  ],
}))
vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({ getAthleteProfile: () => ({}) }))

describe('one acute/chronic source (v5.4)', () => {
  it("prints the Load ratio as the last acute ÷ chronic of Load trend", async () => {
    const { getLoadRiskPanel } = await import('@/application/usecases/GetLoadRiskPanel')
    const risk = await getLoadRiskPanel()
    const pairs = loadPairs(STATUS_DAYS)
    const view = loadTrendView(pairs, dayWindow(TODAY, '4w'), loadTrendYMax(pairs, TODAY))!

    expect(risk!.acute).toBe(view.last.acute)
    expect(risk!.chronic).toBe(view.last.chronic)
    expect(risk!.acwr).toBe(Math.round((view.last.acute / view.last.chronic) * 100) / 100)
    expect(risk!.acwr).toBe(view.ratio)
  })
})

const pairs = (acute: (i: number) => number, chronic = 300, n = 120): LoadPair[] =>
  Array.from({ length: n }, (_, i) => ({ date: day(n - 1 - i), acute: acute(i), chronic }))

describe('loadTrendView', () => {
  it('bands each day at 0.8-1.3 × chronic and reads today against it', () => {
    const view = loadTrendView(pairs(() => 300), dayWindow(TODAY, '4w'), 480)!
    expect(view.points).toHaveLength(28)
    expect(view).toMatchObject({ acute: 300, lo: 240, hi: 390, state: 'in', ratio: 1 })
    expect(view.points.every((p) => !p.out)).toBe(true)
  })

  it('marks the days outside the band and turns today above it', () => {
    const view = loadTrendView(pairs((i) => (i === 100 ? 420 : i === 119 ? 400 : 300)), dayWindow(TODAY, '4w'), 480)!
    expect(view.points.filter((p) => p.out).map((p) => p.acute)).toEqual([420, 400])
    expect(view.state).toBe('above')
  })

  it('reads a year as weekly averages', () => {
    const view = loadTrendView(pairs(() => 300, 300, 400), dayWindow(TODAY, '1y'), 480)!
    expect(view.points.length).toBeGreaterThanOrEqual(52)
    expect(view.points.length).toBeLessThanOrEqual(54)
  })

  it('is null without two days in the window', () => {
    expect(loadTrendView([], dayWindow(TODAY, '4w'), 480)).toBeNull()
  })
})

describe('Load trend after a break (v5.5 #4)', () => {
  // Two weeks off, then back: Garmin's acute load is 0 for the rest days.
  const comeback = pairs((i) => (i < 96 ? 300 : i < 100 ? 0 : i < 110 ? 420 : 330), 300)

  it('draws no warning on rest days, only on days with load outside the band', () => {
    const view = loadTrendView(comeback, dayWindow(TODAY, '4w'), 480)!
    const rest = view.points.filter((p) => p.acute === 0)
    expect(rest.length).toBeGreaterThan(0)
    expect(rest.every((p) => !p.out)).toBe(true)
    expect(view.points.filter((p) => p.out).every((p) => p.acute === 420)).toBe(true)
  })

  it('counts the days that went over and names the last', () => {
    const view = loadTrendView(comeback, dayWindow(TODAY, '4w'), 480)!
    expect(view.state).toBe('in')
    expect(view.over).toEqual({ days: 10, last: day(10) })
  })
})

describe('loadChange', () => {
  it('quotes the climb out of the last four weeks’ trough', () => {
    const series = pairs((i) => (i === 109 ? 250 : i >= 110 ? 250 + (i - 109) * 8 : 300))
    expect(loadChange(series, series.at(-1)!)).toEqual({ pct: 32, days: 10 })
  })

  it('quotes the drop from the peak when load is down', () => {
    const series = pairs((i) => (i === 105 ? 400 : i > 105 ? 300 : 350))
    expect(loadChange(series, series.at(-1)!)).toEqual({ pct: -25, days: 14 })
  })
})

describe('loadChange out of a break', () => {
  it('quotes nothing from a zero or past doubling', () => {
    const fromZero = pairs((i) => (i < 105 ? 0 : 500))
    expect(loadChange(fromZero, fromZero.at(-1)!)).toBeNull()
    const tripled = pairs((i) => (i < 105 ? 150 : 500))
    expect(loadChange(tripled, tripled.at(-1)!)).toBeNull()
  })
})

describe('loadTrendYMax', () => {
  it("holds one range per athlete, from the year's highest acute or safe edge", () => {
    const series = pairs((i) => (i === 50 ? 420 : 300))
    // 420 is the peak; with room for the dot, three steps of 150.
    expect(loadTrendYMax(series, TODAY)).toBe(450)
    const view = loadTrendView(series, dayWindow(TODAY, '4w'), loadTrendYMax(series, TODAY))!
    expect(view.ticks).toEqual([150, 300, 450])
  })
})

const days = (n: number, rhr: (i: number) => number | null) =>
  Array.from({ length: n }, (_, i) => ({ date: day(n - 1 - i), restingHr: rhr(i) })).flatMap((d) =>
    d.restingHr === null ? [] : [{ date: d.date, restingHr: d.restingHr }],
  )
const steady = (i: number) => 46 + (i % 3) - 1

describe('recoveryView', () => {
  it(`hides under ${RECOVERY_MIN_DAYS} days in the window`, () => {
    expect(recoveryView(days(90, (i) => (i < 84 ? null : 46)), dayWindow(TODAY, '4w'))).toBeNull()
  })

  it('draws the baseline from the middle of the last 60 days', () => {
    const view = recoveryView(days(90, steady), dayWindow(TODAY, '4w'))!
    expect([view.restingHr.lo, view.restingHr.hi]).toEqual([45, 47])
    expect(view.out).toBe(false)
  })

  it('flags a resting HR above its baseline', () => {
    const view = recoveryView(days(90, (i) => (i >= 88 ? 52 : steady(i))), dayWindow(TODAY, '4w'))!
    expect(view.restingHr).toEqual({ now: 52, lo: 45, hi: 47, side: 'high' })
    expect(view.out).toBe(true)
  })

  // A resting HR under its baseline is good news, so it is named but never flagged.
  it('does not flag a resting HR below its baseline', () => {
    const view = recoveryView(days(90, (i) => (i >= 88 ? 40 : steady(i))), dayWindow(TODAY, '4w'))!
    expect(view.restingHr.side).toBe('low')
    expect(view.out).toBe(false)
  })
})

describe('loadCoachHeadline', () => {
  const load = (state: LoadTrendView['state'], pct = 18, days = 21) => ({ state, change: { pct, days } }) as LoadTrendView
  const recovery = (out: boolean) => ({ out }) as RecoveryView

  it('takes the first match: spike and dip, spike, dip, building', () => {
    expect(loadCoachHeadline(load('above'), recovery(true))?.kind).toBe('spikeAndDip')
    expect(loadCoachHeadline(load('above'), recovery(false))?.kind).toBe('spike')
    expect(loadCoachHeadline(load('in'), recovery(true))?.kind).toBe('dip')
    expect(loadCoachHeadline(load('in'), recovery(false))).toEqual({ kind: 'building', change: { pct: 18, days: 21 }, recovery: true })
  })

  it('leaves the speed headline when load is not up and nothing is out', () => {
    expect(loadCoachHeadline(load('in', -4), null)).toBeNull()
    expect(loadCoachHeadline(load('below', -30), recovery(false))).toBeNull()
    expect(loadCoachHeadline(null, null)).toBeNull()
  })
})

describe('loadFocusView', () => {
  const bucket = (id: 'aerobicLow' | 'aerobicHigh' | 'anaerobic', verdict: 'below' | 'onTarget' | 'above') =>
    ({ id, load: 500, targetMin: 400, targetMax: 800, verdict, position: 50, targetStart: 25, targetEnd: 75 })
  const balance = (over: Partial<LoadBalanceData> = {}): LoadBalanceData => ({
    date: day(1),
    feedback: 'AEROBIC_HIGH_SHORTAGE',
    buckets: [bucket('aerobicLow', 'above'), bucket('aerobicHigh', 'below'), bucket('anaerobic', 'below')],
    ...over,
  })

  it("takes the watch's phrase, and words an unknown one from the gauges", () => {
    expect(loadFocusView(balance(), TODAY)?.phrase).toBe('AEROBIC_HIGH_SHORTAGE')
    expect(loadFocusView(balance({ feedback: 'SOMETHING_NEW' }), TODAY)?.phrase).toBe('AEROBIC_HIGH_SHORTAGE')
    expect(loadFocusView(balance({ feedback: null, buckets: [bucket('aerobicLow', 'onTarget')] }), TODAY)?.phrase).toBe('BALANCED')
    expect(loadFocusView(balance({ feedback: null, buckets: [bucket('anaerobic', 'above')] }), TODAY)?.phrase).toBe('ABOVE_TARGETS')
  })

  it('hides a balance that is missing, empty or a week old', () => {
    expect(loadFocusView(null, TODAY)).toBeNull()
    expect(loadFocusView(balance({ feedback: 'NO_DATA' }), TODAY)).toBeNull()
    expect(loadFocusView(balance({ buckets: [] }), TODAY)).toBeNull()
    expect(loadFocusView(balance({ date: day(7) }), TODAY)).not.toBeNull()
    expect(loadFocusView(balance({ date: day(8) }), TODAY)).toBeNull()
  })
})
