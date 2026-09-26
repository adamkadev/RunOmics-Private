import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { LoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import type { HeatImpactData, HeatBandId } from '@/application/usecases/GetHeatImpact'
import type { TrainingStatusType } from '@/domain/training/status'
import { formBand, type FormBand } from '@/domain/training/formBand'
import { RACE_DISTANCES, type RaceDistanceKey } from '@/domain/race/distances'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { median } from '@/lib/math'

/**
 * Analytics v4.5 (D1-D4): one question per tab, one answer per card. Every
 * number a card prints is worked out here, from the same series and the same
 * window, so the headline, its sentence and its chart can't disagree - the
 * old tiles said "+0:55 in 12 m" above a chart that said "slipped 1:10 in 6 m".
 */

/** One set of periods on every tab (v4.6); Performance's 6m became 12w. */
export type Period = '4w' | '12w' | '1y'
export type LoadPeriod = Period
export type WeekPeriod = Period

export const PERIODS: Period[] = ['4w', '12w', '1y']
export const LOAD_PERIODS = PERIODS
export const WEEK_PERIODS = PERIODS

const PERIOD_WEEKS: Record<Period, number> = { '4w': 4, '12w': 12, '1y': 52 }

export interface DayWindow {
  start: string
  end: string
  days: number
  /** The window ends today: the "now" markers show. */
  live: boolean
}

export interface WeekWindow {
  /** Mondays, oldest first. */
  weeks: string[]
  start: string
  end: string
  live: boolean
}

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

/** The period's window, `offset` whole windows back from today. */
/**
 * A day-by-day tab's window: the same weeks as the weekly tabs (v4.6), from
 * the Monday that starts them to today, so every tab's range line reads the
 * same "Jul 6 - Sep 26" for the same chip.
 */
export function dayWindow(today: string, period: LoadPeriod, offset = 0): DayWindow {
  const weeks = weekWindow(today, period, offset)
  const end = offset === 0 ? today : weeks.end
  const days = Math.round((day(end).getTime() - day(weeks.start).getTime()) / 86_400_000) + 1
  return { start: weeks.start, end, days, live: offset === 0 }
}

export function weekWindow(today: string, period: WeekPeriod, offset = 0): WeekWindow {
  const n = PERIOD_WEEKS[period]
  const last = addDays(startOfWeek(day(today)), -offset * n * 7)
  const weeks = Array.from({ length: n }, (_, i) => isoDate(addDays(last, -(n - 1 - i) * 7)))
  return { weeks, start: weeks[0]!, end: isoDate(addDays(last, 6)), live: offset === 0 }
}

const mean = (values: number[]): number | null => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null)
const known = (values: (number | null | undefined)[]): number[] => values.filter((v): v is number => v !== null && v !== undefined)

// ─── Inputs ────────────────────────────────────────────────────────────────

export interface LoadDay {
  date: string
  ctl: number
  atl: number
}

export interface StatusDay {
  date: string
  status: TrainingStatusType | null
}

export interface PredictionDay {
  date: string
  seconds: Partial<Record<RaceDistanceKey, number>>
}

export interface PlanWeekInput {
  week: string
  planKm: number | null
  planQuality: number
}

export interface GoalRaceInput {
  distance: RaceDistanceKey
  date: string
  daysUntil: number
  targetSeconds: number | null
}

export interface YtdInput {
  year: number
  daysInYear: number
  todayDay: number
  current: { day: number; km: number }[]
  previous: { day: number; km: number }[]
  /** Last year's distance on today's date. */
  previousToDate: number | null
  goalKm: number | null
  projection: { weeklyRate: number; weeklyNeeded: number; projectedYearKm: number } | null
}

// ─── D1 Load ───────────────────────────────────────────────────────────────

/** 12 pt of a 110 pt chart. */
const FORM_LABEL_CLEARANCE = 12 / 110

export interface FormView {
  form: number
  band: FormBand
  fitness: number
  fitnessDelta: number
  fatigue: number
  fatigueDelta: number
  /** Chart points, one per day. */
  ctl: number[]
  atl: number[]
  /** The strip: one bar a day on 4 weeks, one a week on longer periods. */
  bars: { form: number; band: FormBand; date: string }[]
  yMax: number
  dates: string[]
}

export function formView(load: LoadDay[], window: DayWindow): FormView | null {
  const points = load.filter((p) => p.date >= window.start && p.date <= window.end)
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last || points.length < 2) return null

  // Form is fitness minus fatigue, rounded once - Today's Body card reads it
  // the same way, so the two screens print the same number.
  const formOf = (p: LoadDay) => Math.round(p.ctl - p.atl)
  const daily = window.days <= 28
  const barPoints = daily ? points : points.filter((p, i) => i === points.length - 1 || day(p.date).getDay() === 0)
  const peak = Math.max(...points.map((p) => Math.max(p.ctl, p.atl)))

  return {
    form: formOf(last),
    band: formBand(formOf(last)),
    fitness: Math.round(last.ctl),
    fitnessDelta: Math.round(last.ctl) - Math.round(first.ctl),
    fatigue: Math.round(last.atl),
    fatigueDelta: Math.round(last.atl) - Math.round(first.atl),
    ctl: points.map((p) => p.ctl),
    atl: points.map((p) => p.atl),
    bars: barPoints.map((p) => ({ form: formOf(p), band: formBand(formOf(p)), date: p.date })),
    // The top label needs 12 pt clear of the lines on a 110 pt chart.
    yMax: Math.max(75, Math.ceil(peak / (1 - FORM_LABEL_CLEARANCE) / 25) * 25),
    dates: points.map((p) => p.date),
  }
}

export interface StatusView {
  current: TrainingStatusType
  count: number
  days: number
  /** One cell a day on 4 weeks, one a week (its most common status) beyond. */
  cells: { status: TrainingStatusType | null; date: string }[]
  totals: { status: TrainingStatusType; days: number }[]
}

export function statusView(days: StatusDay[], window: DayWindow): StatusView | null {
  const inWindow = days.filter((d) => d.date >= window.start && d.date <= window.end)
  const current = [...inWindow].reverse().find((d) => d.status !== null)?.status ?? null
  if (!current) return null

  const tally = new Map<TrainingStatusType, number>()
  for (const d of inWindow) if (d.status) tally.set(d.status, (tally.get(d.status) ?? 0) + 1)
  const totals = [...tally.entries()].map(([status, n]) => ({ status, days: n })).sort((a, b) => b.days - a.days)

  let cells: StatusView['cells']
  if (window.days <= 28) {
    cells = inWindow.map((d) => ({ status: d.status, date: d.date }))
  } else {
    const byWeek = new Map<string, StatusDay[]>()
    for (const d of inWindow) {
      const monday = isoDate(startOfWeek(day(d.date)))
      byWeek.set(monday, [...(byWeek.get(monday) ?? []), d])
    }
    cells = [...byWeek.entries()].map(([monday, list]) => {
      const count = new Map<TrainingStatusType, number>()
      for (const d of list) if (d.status) count.set(d.status, (count.get(d.status) ?? 0) + 1)
      const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]
      return { status: top?.[0] ?? null, date: monday }
    })
  }

  return { current, count: tally.get(current) ?? 0, days: window.days, cells, totals }
}

export type RiskState = 'ok' | 'out' | 'alert'

export interface RiskRow {
  key: 'loadRatio' | 'monotony' | 'rampRate'
  value: number
  state: RiskState
  /** Scale, safe range and the edges the labels sit at. */
  min: number
  max: number
  lo: number
  hi: number
  /** No label at a range edge that is the scale's own end. */
  labelLo: boolean
}

interface RiskScale {
  min: number
  max: number
  lo: number
  hi: number
  /** Beyond this the marker goes to Z5 rather than amber. */
  alert: (v: number) => boolean
}

/**
 * The same bands as the domain's risk zones (GetLoadRiskPanel): a ratio of
 * 0.8-1.3 is safe and above 1.5 is risk; monotony above 2 is risk; a ramp
 * beyond ±5 a week is caution and beyond ±8 risk.
 */
const RISK_SCALES: Record<RiskRow['key'], RiskScale> = {
  loadRatio: { min: 0.4, max: 2, lo: 0.8, hi: 1.3, alert: (v) => v > 1.5 },
  monotony: { min: 0, max: 3, lo: 0, hi: 2, alert: (v) => v > 2 },
  rampRate: { min: -10, max: 10, lo: -5, hi: 5, alert: (v) => Math.abs(v) > 8 },
}

export function riskRows(risk: LoadRiskPanel | null): RiskRow[] {
  if (!risk) return []
  const values: [RiskRow['key'], number | null][] = [
    ['loadRatio', risk.acwr],
    ['monotony', risk.monotony],
    ['rampRate', risk.rampRate],
  ]
  return values.flatMap(([key, value]) => {
    if (value === null) return []
    const scale = RISK_SCALES[key]
    const inRange = value >= scale.lo && value <= scale.hi
    const state: RiskState = inRange ? 'ok' : scale.alert(value) ? 'alert' : 'out'
    return [{ key, value, state, min: scale.min, max: scale.max, lo: scale.lo, hi: scale.hi, labelLo: scale.lo > scale.min }]
  })
}

// ─── D2 Performance ────────────────────────────────────────────────────────

/** VO2max's change is read over 12 weeks, the Performance tab's default. */
const VO2_WINDOW_DAYS = 84

export interface Vo2View {
  value: number
  /** Over the last 90 days, as Progress prints it: one source for both. */
  delta: number | null
}

/**
 * Garmin's latest VO2max, and its change over 90 days - the reading Progress
 * shows. Analytics used to print the last monthly average (54.8 beside 55.0).
 */
export function vo2View(value: number | null, samples: { date: string; vo2max: number }[], today: string): Vo2View | null {
  const since = isoDate(addDays(day(today), -VO2_WINDOW_DAYS))
  const recent = samples.filter((s) => s.date >= since && s.date <= today)
  const latest = value ?? recent.at(-1)?.vo2max ?? null
  if (latest === null) return null
  return { value: latest, delta: recent.length >= 2 ? Math.round(recent.at(-1)!.vo2max - recent[0]!.vo2max) : null }
}

export interface PaceShift {
  now: number
  /** Seconds per km, positive when slower. */
  delta: number | null
}

/** The window's weeks: every week whose Monday falls inside it, or just before. */
export function weeksIn(weeks: WeeklyTrendPoint[], window: { start: string; end: string }): WeeklyTrendPoint[] {
  const from = isoDate(startOfWeek(day(window.start)))
  return weeks.filter((w) => w.date >= from && w.date <= window.end)
}

/**
 * A pace now against the window's start: the median of its last few weeks
 * against the median of its first few. The summary strip and the Pace trend
 * sentence both read this, so "28 s faster" is the same 28 s in both.
 */
export function paceShift(weeks: WeeklyTrendPoint[], pick: (w: WeeklyTrendPoint) => number | null): PaceShift | null {
  const values = known(weeks.map(pick))
  if (!values.length) return null
  const block = Math.max(1, Math.min(4, Math.floor(values.length / 2)))
  const now = Math.round(median(values.slice(-block)))
  if (values.length < 2) return { now, delta: null }
  return { now, delta: now - Math.round(median(values.slice(0, block))) }
}

export function thresholdShift(points: { date: string; pace: number }[], window: DayWindow): PaceShift | null {
  const upTo = points.filter((p) => p.date <= window.end)
  const latest = upTo.at(-1)
  if (!latest) return null
  const before = [...upTo].reverse().find((p) => p.date <= window.start) ?? upTo.find((p) => p.date >= window.start)
  return { now: latest.pace, delta: before && before !== latest ? latest.pace - before.pace : null }
}

export interface PredictionRow {
  distance: RaceDistanceKey
  seconds: number
  delta: number | null
  series: number[]
}

export function predictionRows(days: PredictionDay[], window: DayWindow): PredictionRow[] {
  const inWindow = days.filter((d) => d.date >= window.start && d.date <= window.end)
  return RACE_DISTANCES.flatMap((distance) => {
    const series = known(inWindow.map((d) => d.seconds[distance]))
    const last = series.at(-1)
    if (last === undefined) return []
    return [{ distance, seconds: last, delta: series.length >= 2 ? last - series[0]! : null, series }]
  })
}

/** Under five seconds either way is a prediction holding, not moving. */
const PREDICTION_NOISE_SEC = 5

export type PredictionTrend =
  | { kind: 'slipped' | 'improved'; lo: number; hi: number; unit: 'min' | 's'; count: number }
  | { kind: 'held'; count: number }
  | { kind: 'mixed'; faster: number; count: number }

export function predictionTrend(rows: PredictionRow[]): PredictionTrend | null {
  const deltas = known(rows.map((r) => r.delta))
  if (!deltas.length) return null
  const count = deltas.length
  if (deltas.every((d) => Math.abs(d) < PREDICTION_NOISE_SEC)) return { kind: 'held', count }
  const slower = deltas.every((d) => d >= PREDICTION_NOISE_SEC)
  const faster = deltas.every((d) => d <= -PREDICTION_NOISE_SEC)
  if (!slower && !faster) return { kind: 'mixed', faster: deltas.filter((d) => d <= -PREDICTION_NOISE_SEC).length, count }
  const abs = deltas.map(Math.abs)
  const inMinutes = Math.max(...abs) >= 60
  const scale = (s: number) => (inMinutes ? Math.max(1, Math.round(s / 60)) : Math.round(s))
  return { kind: slower ? 'slipped' : 'improved', lo: scale(Math.min(...abs)), hi: scale(Math.max(...abs)), unit: inMinutes ? 'min' : 's', count }
}

export interface EfficiencyView {
  now: number
  delta4w: number | null
  delta12w: number | null
  /** Heat-adjusted minus measured over the last four weeks: what heat costs. */
  heatCost: number | null
  trend: 'dipping' | 'rising' | 'steady'
  adjusted: (number | null)[]
  measured: (number | null)[]
  dates: string[]
}

/** A change under 0.02 m per beat is week-to-week noise. */
const EF_NOISE = 0.02

export function efficiencyView(allWeeks: WeeklyTrendPoint[], windowWeeks: WeeklyTrendPoint[], end: string): EfficiencyView | null {
  const upTo = allWeeks.filter((w) => w.date <= end)
  const adjustedOf = (w: WeeklyTrendPoint) => w.efAdjusted ?? w.ef
  const block = (from: number, to: number) => mean(known(upTo.slice(Math.max(0, upTo.length - to), upTo.length - from).map(adjustedOf)))
  const now = block(0, 4)
  if (now === null) return null
  const prev4 = block(4, 8)
  const prev12 = block(12, 16)
  const recent = upTo.slice(-4)
  const heat = mean(known(recent.map((w) => (w.efAdjusted !== null && w.ef !== null ? w.efAdjusted - w.ef : null))))
  const delta4w = prev4 === null ? null : round2(now - prev4)
  return {
    now: round2(now),
    delta4w,
    delta12w: prev12 === null ? null : round2(now - prev12),
    heatCost: heat === null ? null : round2(heat),
    trend: delta4w === null || Math.abs(delta4w) < EF_NOISE ? 'steady' : delta4w < 0 ? 'dipping' : 'rising',
    adjusted: windowWeeks.map(adjustedOf),
    measured: windowWeeks.map((w) => w.ef),
    dates: windowWeeks.map((w) => w.date),
  }
}

/**
 * A centred three-week mean, for drawing only: a single week's pace or
 * efficiency swings with its weather and its one workout, and the line is
 * there to show the trend. The numbers printed come from the raw weeks.
 */
export function smooth(values: (number | null)[]): (number | null)[] {
  if (values.length <= 8) return values
  return values.map((v, i) => {
    if (v === null) return null
    const around = known(values.slice(Math.max(0, i - 1), i + 2))
    return mean(around)
  })
}

/** At most `max` points of a long daily series, the last one always kept. */
export function thin(values: number[], max = 26): number[] {
  if (values.length <= max) return values
  const step = (values.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => values[Math.round(i * step)]!)
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export interface RpeView {
  avg: number
  trend: 'easing' | 'rising' | 'steady'
  bars: (number | null)[]
}

export function rpeView(allWeeks: WeeklyTrendPoint[], end: string): RpeView | null {
  const last8 = allWeeks.filter((w) => w.date <= end).slice(-8)
  const recent = mean(known(last8.slice(-4).map((w) => w.avgRpe)))
  if (recent === null) return null
  const before = mean(known(last8.slice(0, -4).map((w) => w.avgRpe)))
  const diff = before === null ? 0 : recent - before
  return {
    avg: Math.round(recent * 10) / 10,
    trend: diff <= -0.2 ? 'easing' : diff >= 0.2 ? 'rising' : 'steady',
    bars: last8.map((w) => w.avgRpe),
  }
}

export const HEAT_BAND_ORDER: HeatBandId[] = ['cold', 'cool', 'mild', 'warm', 'hot']
const WARM_BANDS: HeatBandId[] = ['warm', 'hot']

export interface HeatRow {
  id: HeatBandId
  pace: number | null
  cost: number | null
  best: boolean
}

export interface HeatView {
  refHeartRate: number
  rows: HeatRow[]
  /** The cost range above 20°C, from the same rows the bars draw. */
  warm: { lo: number; hi: number } | null
  scale: number
}

export function heatView(data: HeatImpactData | null): HeatView | null {
  if (!data) return null
  const byId = new Map(data.bands.map((b) => [b.id, b]))
  const rows = HEAT_BAND_ORDER.map((id) => {
    const band = byId.get(id)
    return { id, pace: band?.paceAtRefHr ?? null, cost: band?.costSecPerKm ?? null, best: band?.costSecPerKm === 0 }
  })
  const warmCosts = known(rows.filter((r) => WARM_BANDS.includes(r.id)).map((r) => r.cost))
  return {
    refHeartRate: data.refHeartRate,
    rows,
    warm: warmCosts.length ? { lo: Math.min(...warmCosts), hi: Math.max(...warmCosts) } : null,
    scale: Math.max(20, ...known(rows.map((r) => r.cost))),
  }
}

// ─── D3 Volume ─────────────────────────────────────────────────────────────

/** A week is on plan once it reaches 90% of its planned distance. */
export const ON_PLAN_SHARE = 0.9

export interface WeekRow {
  week: string
  km: number
  planKm: number | null
  current: boolean
  point: WeeklyTrendPoint | null
}

export function weekRows(weeks: WeeklyTrendPoint[], plan: PlanWeekInput[], window: WeekWindow, today: string): WeekRow[] {
  const byWeek = new Map(weeks.map((w) => [w.date, w]))
  const planByWeek = new Map(plan.map((p) => [p.week, p]))
  const thisMonday = isoDate(startOfWeek(day(today)))
  return window.weeks.map((week) => {
    const point = byWeek.get(week) ?? null
    return { week, km: point?.distanceKm ?? 0, planKm: planByWeek.get(week)?.planKm ?? null, current: week === thisMonday, point }
  })
}

export interface WeeklyDistanceView {
  last: WeekRow
  avg: number | null
  onPlan: { hit: number; of: number } | null
  /** Weeks in the window the plan said nothing about. */
  withoutPlan: number
  yMax: number
}

/**
 * `avgKm` is the app's one weekly average (domain/training/weeklyAverage),
 * passed in while the window is the current one; a window further back reads
 * its own finished weeks.
 */
export function weeklyDistanceView(rows: WeekRow[], avgKm: number | null = null): WeeklyDistanceView | null {
  const last = rows.at(-1)
  if (!last) return null
  // The week under way is not a week's distance yet, so it stays out of the
  // average. It does count against its plan (v4.6: every week the chart draws
  // a plan line on is in "of"), on plan only once it has already made it.
  const done = rows.filter((r) => !r.current)
  const planned = rows.filter((r) => r.planKm !== null && r.planKm > 0)
  const peak = Math.max(...rows.map((r) => Math.max(r.km, r.planKm ?? 0)), 10)
  return {
    last,
    avg: avgKm ?? (done.length ? mean(done.map((r) => r.km))! : null),
    onPlan: planned.length ? { hit: planned.filter((r) => r.km >= r.planKm! * ON_PLAN_SHARE).length, of: planned.length } : null,
    withoutPlan: rows.filter((r) => r.planKm === null || r.planKm <= 0).length,
    yMax: Math.ceil(peak / 10) * 10,
  }
}

/** A long run above this share of its week's distance loads one day heavily. */
export const LONG_RUN_SHARE = 0.35

export interface LongRunView {
  km: number
  date: string | null
  share: number | null
  bars: { km: number; over: boolean; current: boolean }[]
  over: number
  yMax: number
}

export function longRunView(rows: WeekRow[]): LongRunView | null {
  const last = rows.at(-1)
  if (!last || rows.every((r) => !r.point || r.point.longestKm === 0)) return null
  const bars = rows.map((r) => {
    const km = r.point?.longestKm ?? 0
    // The week under way counts too, once it is past the share (v4.6).
    return { km, over: r.km > 0 && km / r.km > LONG_RUN_SHARE, current: r.current }
  })
  return {
    km: last.point?.longestKm ?? 0,
    date: last.point?.longestDate ?? null,
    share: last.km > 0 && last.point ? Math.round((last.point.longestKm / last.km) * 100) : null,
    bars,
    over: bars.filter((b) => b.over).length,
    yMax: Math.max(...bars.map((b) => b.km), 1),
  }
}

// ─── D4 Intensity ──────────────────────────────────────────────────────────

export interface EasyHardView {
  easySec: number
  moderateSec: number
  hardSec: number
  easyPct: number
  moderatePct: number
  hardPct: number
  status: 'inRange' | 'tooModerate' | 'tooHard'
  totalSec: number
}

/** Above this share of Z3 the week has drifted into the moderate middle. */
const MODERATE_LIMIT_PCT = 10
/** Below this share of easy time the split is off the 80/20 target. */
const EASY_FLOOR_PCT = 75

export function easyHardView(rows: WeekRow[]): EasyHardView | null {
  const zone = (z: number) => rows.reduce((s, r) => s + (r.point?.zoneSeconds[z] ?? 0), 0)
  const easySec = zone(1) + zone(2)
  const moderateSec = zone(3)
  const hardSec = zone(4) + zone(5)
  const totalSec = easySec + moderateSec + hardSec
  if (totalSec <= 0) return null
  const easyPct = Math.round((easySec / totalSec) * 100)
  const moderatePct = Math.round((moderateSec / totalSec) * 100)
  const hardPct = 100 - easyPct - moderatePct
  return {
    easySec,
    moderateSec,
    hardSec,
    easyPct,
    moderatePct,
    hardPct,
    status: moderatePct > MODERATE_LIMIT_PCT ? 'tooModerate' : easyPct < EASY_FLOOR_PCT ? 'tooHard' : 'inRange',
    totalSec,
  }
}

export interface ZonesView {
  /** Hours per zone (Z1-Z5), a row a week. */
  weeks: { hours: number[]; current: boolean }[]
  hard: { lo: number; hi: number } | null
  total: 'grew' | 'dropped' | 'held' | 'recovered'
  /** The low week total time came back from, when it did. */
  recoveredAfter: string | null
  /** Hours over the window, the week under way included. */
  totalHours: number
  yMax: number
}

const roundTo5 = (min: number) => Math.round(min / 5) * 5

export function zonesView(rows: WeekRow[]): ZonesView | null {
  const weeks = rows.map((r) => ({ hours: [1, 2, 3, 4, 5].map((z) => (r.point?.zoneSeconds[z] ?? 0) / 3600), current: r.current }))
  const totals = weeks.map((w) => w.hours.reduce((s, h) => s + h, 0))
  if (totals.every((h) => h === 0)) return null
  const done = rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.current)
  const hardMin = done.map(({ i }) => (weeks[i]!.hours[3]! + weeks[i]!.hours[4]!) * 60)
  const doneTotals = done.map(({ i }) => totals[i]!)
  // A dip and a return (a week off, then back to full weeks) is neither
  // "grew" nor "dropped": halves averaged over it said "dropped" beside
  // three of the highest weeks (v4.6).
  const trough = doneTotals.length >= 4 ? doneTotals.slice(1, -1).reduce((lo, v, k) => (v < doneTotals[lo]! ? k + 1 : lo), 1) : -1
  const before = trough > 0 ? mean(doneTotals.slice(0, trough)) : null
  // Back to full weeks by the end - a lighter week of coming back is normal.
  const after = trough > 0 && trough < doneTotals.length - 2 ? mean(doneTotals.slice(-2)) : null
  const recovered = before !== null && after !== null && before > 0 && doneTotals[trough]! < before * 0.5 && after >= before * 0.9
  const half = Math.floor(doneTotals.length / 2)
  const first = mean(doneTotals.slice(0, half))
  const second = mean(doneTotals.slice(-half))
  const change = first && second !== null ? (second - first) / first : 0
  return {
    weeks,
    hard: hardMin.length ? { lo: roundTo5(Math.min(...hardMin)), hi: roundTo5(Math.max(...hardMin)) } : null,
    total: recovered ? 'recovered' : change >= 0.1 ? 'grew' : change <= -0.1 ? 'dropped' : 'held',
    recoveredAfter: recovered ? rows[done[trough]!.i]!.week : null,
    totalHours: totals.reduce((a, b) => a + b, 0),
    yMax: Math.max(1, Math.ceil(Math.max(...totals))),
  }
}

export type QualityDot = 'threshold' | 'intervals' | 'missed'

export interface QualityView {
  weeks: QualityDot[][]
  avg: number | null
  planAsks: number | null
  /** What the plan had each week, for the readout; null for a week without one. */
  planned: (number | null)[]
}

export function qualityView(rows: WeekRow[], plan: PlanWeekInput[]): QualityView | null {
  const planByWeek = new Map(plan.map((p) => [p.week, p.planQuality]))
  const weeks = rows.map((r) => {
    const threshold = r.point?.thresholdSessions ?? 0
    const intervals = r.point?.intervalSessions ?? 0
    // The week under way has its planned sessions still to come, not missed.
    const missed = r.current ? 0 : Math.max(0, (planByWeek.get(r.week) ?? 0) - threshold - intervals)
    return [
      ...Array<QualityDot>(threshold).fill('threshold'),
      ...Array<QualityDot>(intervals).fill('intervals'),
      ...Array<QualityDot>(missed).fill('missed'),
    ]
  })
  const done = rows.filter((r) => !r.current)
  if (!done.length && weeks.every((w) => w.length === 0)) return null
  const planned = known(rows.map((r) => planByWeek.get(r.week)))
  return {
    weeks,
    avg: done.length ? Math.round((mean(done.map((r) => (r.point?.thresholdSessions ?? 0) + (r.point?.intervalSessions ?? 0))) ?? 0) * 10) / 10 : null,
    // One decimal: plans ran from 1 to 3 a week, and a rounded "1" read as
    // every week's plan beside a week that had 3 (v4.6 item 4).
    planAsks: planned.length ? Math.round(mean(planned)! * 10) / 10 : null,
    planned: rows.map((r) => planByWeek.get(r.week) ?? null),
  }
}

// ─── Coach read (v4.6) ─────────────────────────────────────────────────────

export type Trend = 'improving' | 'flat' | 'declining'

export type CoachSignal =
  | { key: 'easy'; trend: Trend; pace: number; delta: number }
  | { key: 'predictions'; trend: Trend; slower: number; faster: number; count: number }
  | { key: 'efficiency'; trend: Trend; value: number; delta: number }
  | { key: 'volume'; trend: Trend; delta: number }

export interface CoachReadView {
  tone: 'positive' | 'neutral' | 'caution'
  /** Fitness went up over the last four weeks. */
  loadUp: boolean
  signals: CoachSignal[]
}

/** Under two seconds a kilometre either way, easy pace held. */
const EASY_NOISE_SEC = 2

const trendOf = (delta: number, noise: number, lowerIsBetter: boolean): Trend =>
  Math.abs(delta) < noise ? 'flat' : (delta < 0) === lowerIsBetter ? 'improving' : 'declining'

/**
 * The coach read, from the values the cards print (v4.6): the Pace trend's
 * easy shift, the race predictions, aerobic efficiency and Year to date. The
 * headline used to be hard-coded praise ("yielding real speed") above four
 * slower predictions.
 */
export function coachRead(input: {
  easy: PaceShift | null
  predictions: PredictionRow[]
  efficiency: EfficiencyView | null
  fitnessDelta: number | null
  ytdDelta: number | null
}): CoachReadView | null {
  const signals: CoachSignal[] = []
  const { easy, predictions, efficiency } = input
  if (easy && easy.delta !== null) signals.push({ key: 'easy', trend: trendOf(easy.delta, EASY_NOISE_SEC, true), pace: easy.now, delta: easy.delta })
  const moved = known(predictions.map((r) => r.delta))
  if (moved.length) {
    const slower = moved.filter((d) => d >= PREDICTION_NOISE_SEC).length
    const faster = moved.filter((d) => d <= -PREDICTION_NOISE_SEC).length
    signals.push({ key: 'predictions', trend: slower > faster ? 'declining' : faster > slower ? 'improving' : 'flat', slower, faster, count: moved.length })
  }
  if (efficiency && efficiency.delta4w !== null) {
    signals.push({ key: 'efficiency', trend: efficiency.trend === 'dipping' ? 'declining' : efficiency.trend === 'rising' ? 'improving' : 'flat', value: efficiency.now, delta: efficiency.delta4w })
  }
  if (input.ytdDelta !== null) signals.push({ key: 'volume', trend: trendOf(input.ytdDelta, 1, false), delta: input.ytdDelta })
  const speed = signals.filter((s) => s.key !== 'volume')
  if (!speed.length) return null
  const score = speed.filter((s) => s.trend === 'improving').length - speed.filter((s) => s.trend === 'declining').length
  return { tone: score > 0 ? 'positive' : score < 0 ? 'caution' : 'neutral', loadUp: (input.fitnessDelta ?? 0) > 0, signals }
}
