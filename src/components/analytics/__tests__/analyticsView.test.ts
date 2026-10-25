import { describe, expect, it } from 'vitest'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { LoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { addDays, isoDate } from '@/lib/calendarDate'
import {
  coachRead,
  yearOverYear,
  dayWindow,
  easyHardView,
  efficiencyView,
  formView,
  heatView,
  longRunView,
  MISSED_CLUSTER,
  missedClusters,
  paceShift,
  predictionRows,
  predictionTone,
  predictionTrend,
  qualityView,
  riskRows,
  rpeView,
  statusView,
  vo2View,
  weekRows,
  weekWindow,
  weeklyDistanceView,
  zonesView,
} from '../analyticsView'

const TODAY = '2026-09-26' // a Saturday

function week(date: string, over: Partial<WeeklyTrendPoint> = {}): WeeklyTrendPoint {
  return {
    date,
    distanceKm: 0,
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
    zoneSeconds: {},
    longestKm: 0,
    longestDate: null,
    thresholdSessions: 0,
    intervalSessions: 0,
    ...over,
  }
}

const mondays = (n: number, last = '2026-09-21') =>
  Array.from({ length: n }, (_, i) => isoDate(addDays(new Date(`${last}T00:00:00`), -(n - 1 - i) * 7)))

describe('the tab windows', () => {
  it('ends the load window today and steps back a whole window per swipe', () => {
    // The last 28 / 84 / 365 days ending today.
    expect(dayWindow(TODAY, '4w')).toEqual({ start: '2026-08-30', end: TODAY, days: 28, live: true })
    expect(dayWindow(TODAY, '4w', 1)).toMatchObject({ start: '2026-08-02', end: '2026-08-29', days: 28, live: false })
    expect(dayWindow(TODAY, '12w')).toMatchObject({ start: '2026-07-05', days: 84 })
    expect(dayWindow(TODAY, '1y')).toMatchObject({ start: '2025-09-27', days: 365 })
  })

  it('ends the week window on the current week, Monday to Sunday', () => {
    const w = weekWindow(TODAY, '12w')
    expect(w.weeks).toHaveLength(12)
    expect(w.weeks.at(-1)).toBe('2026-09-21')
    expect(w.start).toBe('2026-07-06')
    expect(w.end).toBe('2026-09-27')
    expect(weekWindow(TODAY, '4w', 1).weeks.at(-1)).toBe('2026-08-24')
  })
})

describe('D1 Load', () => {
  const load = Array.from({ length: 40 }, (_, i) => ({ date: isoDate(addDays(new Date('2026-08-18T00:00:00'), i)), ctl: 38 + i * 0.16, atl: 14 + i * 0.95 }))

  it('prints Form as fitness minus fatigue rounded once, as Today does, with the window deltas', () => {
    const view = formView(load, dayWindow(TODAY, '4w'))!
    const last = load.at(-1)!
    expect(view.form).toBe(Math.round(last.ctl - last.atl))
    expect(view.form).toBe(-7)
    expect(view.band).toBe('neutral')
    expect(view.fitness).toBe(Math.round(last.ctl))
    expect(view.bars).toHaveLength(28)
    expect(view.yMax).toBe(75)
  })

  it('draws one bar a week beyond four weeks', () => {
    const long = Array.from({ length: 200 }, (_, i) => ({ date: isoDate(addDays(new Date('2026-03-10T00:00:00'), i)), ctl: 40, atl: 40 }))
    const view = formView(long, dayWindow(TODAY, '12w'))!
    expect(view.bars.length).toBeGreaterThanOrEqual(12)
    expect(view.bars.length).toBeLessThanOrEqual(13)
  })

  it("counts the current status's days over the window, and the rest by count", () => {
    const days = [
      ...Array.from({ length: 5 }, () => 'detraining' as const),
      'recovery' as const,
      ...Array.from({ length: 8 }, () => 'overreaching' as const),
      ...Array.from({ length: 14 }, () => 'productive' as const),
    ].map((status, i) => ({ date: isoDate(addDays(new Date('2026-08-30T00:00:00'), i)), status }))
    const view = statusView(days, dayWindow(TODAY, '4w'))!
    expect(view.current).toBe('productive')
    expect(view.count).toBe(14)
    // "13 of the last 28 days", not 27.
    expect(view.days).toBe(28)
    expect(view.cells).toHaveLength(28)
    expect(view.totals.map((t) => t.status)).toEqual(['productive', 'overreaching', 'detraining', 'recovery'])
  })

  it('marks a risk out of range as caution, and beyond the alert limit as an alert', () => {
    const panel = { acwr: 1.13, monotony: 1.5, rampRate: 2.4 } as LoadRiskPanel
    expect(riskRows(panel).map((r) => r.state)).toEqual(['ok', 'ok'])
    // The load ratio is read beside the load on Load trend, not as one of the injury checks.
    expect(riskRows(panel).map((r) => r.key)).toEqual(['monotony', 'rampRate'])
    expect(riskRows({ ...panel, rampRate: -6 }).find((r) => r.key === 'rampRate')!.state).toBe('out')
    expect(riskRows({ ...panel, monotony: 2.3 }).find((r) => r.key === 'monotony')!.state).toBe('alert')
    // Monotony's range starts at the scale's own end: no label there.
    expect(riskRows(panel).find((r) => r.key === 'monotony')!.labelLo).toBe(false)
  })
})

describe('D2 Performance', () => {
  it("reads Garmin's latest VO2max and its 90-day change, as Progress does", () => {
    const samples = [
      { date: '2026-06-01', vo2max: 57 },
      { date: '2026-07-10', vo2max: 56 },
      { date: '2026-09-20', vo2max: 55 },
    ]
    expect(vo2View(55, samples, TODAY)).toEqual({ value: 55, delta: -1 })
    // To one decimal, as the value is printed: 55.8 to 56.0 is not "No change".
    expect(vo2View(56, [{ date: '2026-07-16', vo2max: 55.8 }, { date: '2026-09-20', vo2max: 56.0 }], TODAY)!.delta).toBe(0.2)
    expect(vo2View(null, samples, TODAY)!.value).toBe(55)
  })

  it('works a pace shift out of medians at both ends of the window', () => {
    const weeks = [380, 378, 376, 370, 360, 356, 352, 350].map((p, i) => week(mondays(8)[i]!, { easyPace: p }))
    const shift = paceShift(weeks, (w) => w.easyPace)!
    expect(shift.now).toBe(354)
    expect(shift.delta).toBe(354 - 377)
  })

  it('reads every prediction delta over the same window', () => {
    const days = [
      { date: '2026-06-01', seconds: { '5k': 1100 } },
      { date: '2026-07-10', seconds: { '5k': 1154, '10k': 2445 } },
      { date: '2026-09-25', seconds: { '5k': 1224, '10k': 2570 } },
    ]
    const rows = predictionRows(days, dayWindow(TODAY, '12w'))
    expect(rows.map((r) => [r.distance, r.delta])).toEqual([
      ['5k', 70],
      ['10k', 125],
    ])
    // In seconds, printed like each row's change.
    expect(predictionTrend(rows)).toEqual({ kind: 'slipped', lo: 70, hi: 125, count: 2, of: 2 })
  })

  // One rule for the row and the sentence: any slower time is a caution.
  it('reads a prediction as moved by the same rule its row is coloured by', () => {
    const days = [
      { date: '2026-07-16', seconds: { '5k': 1208, '10k': 2544, half: 5712, marathon: 12611 } },
      { date: '2026-10-07', seconds: { '5k': 1224, '10k': 2552, half: 5770, marathon: 12765 } },
    ]
    const rows = predictionRows(days, dayWindow('2026-10-07', '12w'))
    expect(rows.map(predictionTone)).toEqual(['worse', 'worse', 'worse', 'worse'])
    expect(predictionTrend(rows)).toEqual({ kind: 'slipped', lo: 8, hi: 154, count: 4, of: 4 })
    // Only a change that prints as 0 s holds.
    const level = predictionRows([days[0]!, { date: '2026-10-07', seconds: { ...days[0]!.seconds, '5k': 1208.3 } }], dayWindow('2026-10-07', '12w'))
    expect(predictionTone(level[0]!)).toBe('flat')
  })

  it('reads efficiency now against four weeks and six months back, and what heat costs', () => {
    const all = mondays(30).map((d, i) => week(d, { ef: 1.1 + (i < 26 ? 0 : -0.04), efAdjusted: 1.12 + (i < 26 ? 0 : -0.03) }))
    const view = efficiencyView(all, all.slice(-26), '2026-09-27')!
    expect(view.now).toBe(1.09)
    expect(view.delta4w).toBe(-0.03)
    expect(view.heatCost).toBe(0.03)
    expect(view.trend).toBe('dipping')
  })

  it('reads RPE over four weeks against the four before', () => {
    const all = mondays(8).map((d, i) => week(d, { avgRpe: i < 4 ? 4 : 3.4 }))
    expect(rpeView(all, '2026-09-27')).toEqual({ avg: 3.4, trend: 'easing', bars: [4, 4, 4, 4, 3.4, 3.4, 3.4, 3.4] })
  })

  it('takes the heat range from the same bands the bars draw, with a gap for a band with too few runs', () => {
    const view = heatView({
      refHeartRate: 149,
      bands: [
        { id: 'cold', label: '', runCount: 9, avgApparentTempC: 2, paceAtRefHr: 372, costSecPerKm: 13 },
        { id: 'cool', label: '', runCount: 40, avgApparentTempC: 10, paceAtRefHr: 359, costSecPerKm: 0 },
        { id: 'warm', label: '', runCount: 12, avgApparentTempC: 22, paceAtRefHr: 376, costSecPerKm: 17 },
        { id: 'hot', label: '', runCount: 10, avgApparentTempC: 28, paceAtRefHr: 370, costSecPerKm: 11 },
      ],
    })!
    expect(view.warm).toEqual({ lo: 11, hi: 17 })
    expect(view.rows.map((r) => r.id)).toEqual(['cold', 'cool', 'mild', 'warm', 'hot'])
    expect(view.rows.find((r) => r.id === 'mild')!.pace).toBeNull()
    expect(view.rows.find((r) => r.id === 'cool')!.best).toBe(true)
  })
})

describe('D3 Volume', () => {
  const window = weekWindow(TODAY, '12w')
  const kms = [38, 42, 45, 40, 48, 52, 30, 44, 46, 41, 48, 27.3]
  const plans = [40, 44, 46, 42, 48, 50, 32, 44, 46, 44, 48, 48]
  const weeks = window.weeks.map((d, i) => week(d, { distanceKm: kms[i]!, longestKm: [12, 13, 17, 12, 16, 18, 12, 15, 15.5, 13, 16, 14.2][i]!, longestDate: d }))
  const plan = window.weeks.map((d, i) => ({ week: d, planKm: plans[i]!, planQuality: 2 }))
  const rows = weekRows(weeks, plan, window, TODAY)

  it('counts weeks on plan at 90% of the plan, leaving the week under way out of the average', () => {
    const view = weeklyDistanceView(rows)!
    expect(view.last.km).toBe(27.3)
    expect(view.last.current).toBe(true)
    expect(view.avg).toBeCloseTo(kms.slice(0, 11).reduce((a, b) => a + b, 0) / 11)
    // The week under way is never a miss: it counts once it has made its plan
    // (27.3 of 48 hasn't), so it is out of "of" for now.
    expect(view.onPlan).toEqual({ hit: 11, of: 11 })
    const made = rows.map((r) => (r.current ? { ...r, km: 48 } : r))
    expect(weeklyDistanceView(made)!.onPlan).toEqual({ hit: 12, of: 12 })
  })

  // Two runs into a week, its long run is half of it.
  it('flags every finished week whose long run is over 35% of it, never the week under way', () => {
    const view = longRunView(rows)!
    expect(view.km).toBe(14.2)
    expect(view.share).toBe(52)
    expect(view.bars.filter((b) => b.over)).toHaveLength(2)
    expect(view.bars.at(-1)).toMatchObject({ over: false, current: true })
    expect(view.over).toBe(2)
  })

  it('takes the weekly average it is given while the window is the current one', () => {
    expect(weeklyDistanceView(rows, 26.4)!.avg).toBe(26.4)
    expect(weeklyDistanceView(rows)!.withoutPlan).toBe(0)
    const sparse = weekRows(weeks, plan.slice(0, 8), window, TODAY)
    expect(weeklyDistanceView(sparse)!.withoutPlan).toBe(4)
  })

  // A stretch the Volume read names, not one-offs.
  it('finds the missed sessions that came together inside the window, 3 in 7 days', () => {
    expect(MISSED_CLUSTER).toEqual({ sessions: 3, days: 7 })
    expect(missedClusters(['2026-09-18', '2026-09-19', '2026-09-24'], rows)).toEqual([{ from: '2026-09-18', to: '2026-09-24', sessions: 3 }])
    // Three across 8 days is not one.
    expect(missedClusters(['2026-09-14', '2026-09-18', '2026-09-21'], rows)).toEqual([])
    // Groups that share a session are one stretch; apart, two.
    expect(missedClusters(['2026-08-03', '2026-08-05', '2026-08-08', '2026-08-11'], rows)).toEqual([{ from: '2026-08-03', to: '2026-08-11', sessions: 4 }])
    expect(missedClusters(['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-17', '2026-08-18', '2026-08-20'], rows)).toEqual([
      { from: '2026-08-03', to: '2026-08-05', sessions: 3 },
      { from: '2026-08-17', to: '2026-08-20', sessions: 3 },
    ])
    // Before the window's first Monday is another period's case.
    expect(window.start).toBe('2026-07-06')
    expect(missedClusters(['2026-07-03', '2026-07-04', '2026-07-06', '2026-07-07'], rows)).toEqual([])
  })
})

describe('D4 Intensity', () => {
  const window = weekWindow(TODAY, '4w')
  const zones = (easy: number, mod: number, hard: number) => ({ 1: 0, 2: easy * 3600, 3: mod * 3600, 4: hard * 3600, 5: 0 })

  it('splits easy from moderate and hard, and says when the middle is too big', () => {
    const rows = weekRows(window.weeks.map((d) => week(d, { zoneSeconds: zones(8.4, 0.4, 1.2) })), [], window, TODAY)
    expect(easyHardView(rows)).toMatchObject({ easyPct: 84, moderatePct: 4, hardPct: 12, status: 'inRange' })
    const grey = weekRows(window.weeks.map((d) => week(d, { zoneSeconds: zones(7, 2, 1) })), [], window, TODAY)
    expect(easyHardView(grey)!.status).toBe('tooModerate')
  })

  it("reads hard minutes over the finished weeks only", () => {
    const rows = weekRows(window.weeks.map((d, i) => week(d, { zoneSeconds: zones(3 + i, 0.2, i === 3 ? 0 : 0.4) })), [], window, TODAY)
    const view = zonesView(rows)!
    expect(view.hard).toEqual({ lo: 25, hi: 25 })
    expect(view.total).toBe('grew')
  })

  it("marks the plan's quality sessions not run as missed, never in the week under way", () => {
    const weeks = window.weeks.map((d, i) => week(d, { thresholdSessions: 1, intervalSessions: i % 2 }))
    const plan = window.weeks.map((d) => ({ week: d, planKm: null, planQuality: 2 }))
    const view = qualityView(weekRows(weeks, plan, window, TODAY), plan)!
    // A dot says whether the plan was kept, not which kind of session it was.
    expect(view.weeks[0]).toEqual(['done', 'missed'])
    expect(view.weeks[1]).toEqual(['done', 'done'])
    expect(view.weeks[3]).toEqual(['done', 'done'])
    expect(view.planAsks).toBe(2)
    expect(view.planned).toEqual([2, 2, 2, 2])
    expect(view.avg).toBe(1.3)
  })

  // A session past the plan was still run, so it is drawn as run; "extra" is said in the totals, where done splits
  // into on-plan plus extra and the three add up.
  it('draws every session run, and totals done as on plan plus extra', () => {
    const weeks = window.weeks.map((d, i) => week(d, { thresholdSessions: i === 0 ? 3 : 1, intervalSessions: 0 }))
    const plan = window.weeks.map((d) => ({ week: d, planKm: null, planQuality: 2 }))
    const view = qualityView(weekRows(weeks, plan, window, TODAY), plan)!
    expect(view.weeks[0]).toEqual(['done', 'done', 'done'])
    expect(view.weeks[1]).toEqual(['done', 'missed'])
    // The week under way owes one, and owing is not missing.
    expect(view.weeks[3]).toEqual(['done', 'planned'])
    expect(view.totals).toEqual({ done: 6, onPlan: 5, extra: 1, missed: 2, planned: 8 })
    expect(view.totals.done).toBe(view.totals.onPlan + view.totals.extra)
  })
})

describe('the coach read (v4.6)', () => {
  const easy = { now: 352, delta: 13 }
  const predictions = [
    { distance: '5k' as const, seconds: 1224, delta: 61, series: [] },
    { distance: '10k' as const, seconds: 2570, delta: 96, series: [] },
  ]

  it('reads caution, never praise, when speed went the other way', () => {
    const view = coachRead({ easy, predictions, efficiency: null, fitnessDelta: 6, ytd: { km: 1394, lastYearKm: 640, since: null } })!
    expect(view.tone).toBe('caution')
    expect(view.loadUp).toBe(true)
    expect(view.signals.map((s) => [s.key, s.trend])).toEqual([
      ['easy', 'declining'],
      ['predictions', 'declining'],
      ['volume', 'improving'],
    ])
  })

  it('reads positive when the speed signals improve, neutral when they are flat', () => {
    const faster = predictions.map((p) => ({ ...p, delta: -p.delta! }))
    expect(coachRead({ easy: { now: 352, delta: -20 }, predictions: faster, efficiency: null, fitnessDelta: 0, ytd: null })!.tone).toBe('positive')
    expect(coachRead({ easy: { now: 352, delta: 1 }, predictions: [], efficiency: null, fitnessDelta: 0, ytd: null })!.tone).toBe('neutral')
  })

  // Both are Garmin's estimate of one fitness: counted twice, one slower estimate would outvote faster easy runs.
  it('gives threshold and the race predictions one vote between them', () => {
    const both = coachRead({ threshold: { now: 263, delta: 9 }, easy: { now: 352, delta: -10 }, predictions, efficiency: null, fitnessDelta: 11, ytd: null })!
    expect(both.tone).toBe('neutral')
    // Opposite ways, they cancel inside the vote rather than outvote anything.
    const split = coachRead({ threshold: { now: 263, delta: -9 }, easy: { now: 352, delta: 13 }, predictions, efficiency: null, fitnessDelta: 11, ytd: null })!
    expect(split.tone).toBe('caution')
    expect(split.signals.map((sig) => [sig.key, sig.trend])).toEqual([
      ['threshold', 'improving'],
      ['easy', 'declining'],
      ['predictions', 'declining'],
    ])
  })

  it('calls a change on the edge of its card band level, as the card does', () => {
    const efficiency = (delta12w: number) => ({ now: 1.15, delta4w: 0, delta12w, heatCost: null, trend: 'steady' as const, adjusted: [], measured: [], dates: [] })
    const trends = (easyDelta: number, efDelta: number) =>
      coachRead({ easy: { now: 351, delta: easyDelta }, predictions: [], efficiency: efficiency(efDelta), fitnessDelta: 0, ytd: null })!.signals.map((sig) => sig.trend)
    expect(trends(-2, -0.02)).toEqual(['flat', 'flat'])
    expect(trends(-3, -0.03)).toEqual(['improving', 'declining'])
  })

  it('reads the volume line in the Year to date card\'s band, from its own dates', () => {
    const volume = (ytd: { km: number; lastYearKm: number; since: string | null }) =>
      coachRead({ easy: { now: 352, delta: 1 }, predictions: [], efficiency: null, fitnessDelta: 0, ytd })!.signals.find((sig) => sig.key === 'volume')
    // Under 2% of last year's figure is the same year, as the card colours it.
    expect(volume({ km: 1404, lastYearKm: 1394, since: null })).toEqual({ key: 'volume', trend: 'flat', delta: 10, since: null })
    expect(volume({ km: 1020, lastYearKm: 708, since: '2025-05-03' })).toEqual({ key: 'volume', trend: 'improving', delta: 312, since: '2025-05-03' })
  })
})

describe('year over year (v4.16.4)', () => {
  const run = (date: string, distanceKm: number) => ({ date: `${date}T07:00:00`, distanceKm })

  it('compares from 1 January when last year is covered from the start', () => {
    const runs = [run('2024-12-30', 10), run('2025-02-01', 12), run('2025-09-20', 8), run('2025-10-01', 99), run('2026-01-05', 15), run('2026-09-26', 11)]
    expect(yearOverYear(runs, TODAY)).toEqual({ km: 26, lastYearKm: 20, since: null })
  })

  // The history begins in May 2025, so January to April must not read as growth.
  it('counts both years from the first synced run when it falls partway through last year', () => {
    const runs = [run('2025-05-03', 10), run('2025-09-26', 5), run('2026-02-10', 40), run('2026-05-02', 7), run('2026-05-03', 9), run('2026-09-26', 11)]
    expect(yearOverYear(runs, TODAY)).toEqual({ km: 20, lastYearKm: 15, since: '2025-05-03' })
  })

  it('has nothing to compare without a run last year', () => {
    expect(yearOverYear([run('2024-06-01', 10), run('2026-03-01', 10)], TODAY)).toBeNull()
    expect(yearOverYear([run('2026-03-01', 10)], TODAY)).toBeNull()
  })
})

describe('missed quality sessions (v4.6 item 4)', () => {
  it('never shows more missed than the week planned, and none for a week without a plan', () => {
    const window = weekWindow(TODAY, '4w')
    const weeks = window.weeks.map((d) => week(d))
    const plan = [
      { week: window.weeks[0]!, planKm: null, planQuality: 3 },
      { week: window.weeks[1]!, planKm: null, planQuality: 1 },
    ]
    const view = qualityView(weekRows(weeks, plan, window, TODAY), plan)!
    expect(view.weeks.map((w) => w.filter((d) => d === 'missed').length)).toEqual([3, 1, 0, 0])
    // The average carries its decimal, so a week of 3 doesn't read as "asks for 1".
    expect(view.planAsks).toBe(2)
    expect(view.planned).toEqual([3, 1, null, null])
  })
})

describe('the Time in zones sentence (v4.6)', () => {
  it('reads a dip and a return as a recovery, not as a drop', () => {
    const window = weekWindow(TODAY, '12w')
    const hours = [4, 4.2, 3.8, 4, 4.4, 3.9, 4.1, 0, 1.2, 4.6, 4.8, 2]
    const weeks = window.weeks.map((d, i) => week(d, { zoneSeconds: { 2: hours[i]! * 3600 } }))
    const view = zonesView(weekRows(weeks, [], window, TODAY))!
    expect(view.total).toBe('recovered')
    expect(view.recoveredAfter).toBe(window.weeks[7])
    expect(view.totalHours).toBeCloseTo(hours.reduce((a, b) => a + b, 0))
  })

  it('still reads a steady climb as grew', () => {
    const window = weekWindow(TODAY, '12w')
    const weeks = window.weeks.map((d, i) => week(d, { zoneSeconds: { 2: (2 + i * 0.3) * 3600 } }))
    expect(zonesView(weekRows(weeks, [], window, TODAY))!.total).toBe('grew')
  })
})

describe('race prediction deltas on one line (v5.5 #21)', () => {
  it('signs the change and keeps the unit short', async () => {
    const { signedChange } = await import('../PerformanceTab')
    expect(signedChange(33)).toBe('+33 s')
    expect(signedChange(-70)).toBe('−1:10')
    expect(signedChange(0.2)).toBe('0 s')
    expect(signedChange(null)).toBeNull()
  })
})
