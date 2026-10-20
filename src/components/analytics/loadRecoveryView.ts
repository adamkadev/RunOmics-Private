import { loadRatio, safeRange, type LoadPair } from '@/domain/training/loadTrend'
import type { RecoveryNight } from '@/domain/training/recovery'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { deltaTone, type DeltaTone } from '@/lib/deltaTone'
import type { DayWindow } from './analyticsView'

/**
 * v5.4 Load trend and Recovery: how the load got where Injury risk says it
 * is, and whether the body is absorbing it. Both follow the tab's window, day
 * by day on 4 and 12 weeks and as weekly averages on a year.
 */

const DAY_MS = 86_400_000
const day = (iso: string) => new Date(`${iso}T00:00:00`)
const daysBetween = (from: string, to: string) => Math.round((day(to).getTime() - day(from).getTime()) / DAY_MS)
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length
/** A year's charts plot one point a week. */
const weekly = (window: DayWindow) => window.days > 84

function byWeek<T extends { date: string }>(items: T[]): T[][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const monday = isoDate(startOfWeek(day(item.date)))
    groups.set(monday, [...(groups.get(monday) ?? []), item])
  }
  return [...groups.values()]
}

// ─── Load trend ────────────────────────────────────────────────────────────

export type LoadState = 'in' | 'above' | 'below'

export interface LoadTrendPoint {
  date: string
  acute: number
  lo: number
  hi: number
  /** Outside the band on a day with load; a day at 0 (a break) is rest, not a warning. */
  out: boolean
}

export interface LoadChange {
  /** Percent change of acute load, signed. */
  pct: number
  days: number
}

export interface LoadTrendView {
  points: LoadTrendPoint[]
  /** The window's last day: the headline and the Load ratio's inputs. */
  last: LoadPair
  acute: number
  lo: number
  hi: number
  state: LoadState
  /** The Load ratio printed under Injury risk, from the same pair. */
  ratio: number
  change: LoadChange | null
  /** Days before the last one that went over the band, and the latest of them. */
  over: { days: number; last: string } | null
  yMax: number
  /** Three grid lines, labelled on the right (v5.5 R1). */
  ticks: number[]
}

const stateOf = (acute: number, lo: number, hi: number): LoadState => (acute > hi ? 'above' : acute < lo ? 'below' : 'in')

/** The change the sentence quotes looks back this far. */
const CHANGE_LOOKBACK_DAYS = 28
/** A change past this is not quoted. */
export const MAX_QUOTED_PCT = 100

/**
 * How far acute load has moved to get here: from the lowest point of the last
 * four weeks when it is up on four weeks ago, from the highest when it is
 * down. "Load jumped 31% in 10 days" is the climb out of the last trough.
 */
export function loadChange(pairs: LoadPair[], last: LoadPair): LoadChange | null {
  const from = isoDate(addDays(day(last.date), -CHANGE_LOOKBACK_DAYS))
  const back = pairs.filter((p) => p.date >= from && p.date < last.date)
  const first = back[0]
  if (!first) return null
  const up = last.acute >= first.acute
  const base = back.reduce((pick, p) => (up ? (p.acute < pick.acute ? p : pick) : p.acute > pick.acute ? p : pick), first)
  if (base.acute <= 0) return null
  const pct = Math.round(((last.acute - base.acute) / base.acute) * 100)
  // Out of a week off, "up 327%" says less than the band does: past doubling
  // the sentence reads the range alone.
  if (Math.abs(pct) > MAX_QUOTED_PCT) return null
  return { pct, days: daysBetween(base.date, last.date) }
}

const TICK_STEPS = [20, 25, 50, 100, 150, 200, 250, 300, 400, 500]

/**
 * One y range per athlete: the year's highest acute load or safe edge, with
 * room for the today dot, split into three round grid steps (300 · 600 · 900).
 */
export function loadTrendYMax(pairs: LoadPair[], today: string): number {
  const from = isoDate(addDays(day(today), -364))
  const year = pairs.filter((p) => p.date >= from && p.date <= today)
  const peak = Math.max(0, ...year.map((p) => Math.max(p.acute, safeRange(p.chronic).hi))) * 1.06
  const step = TICK_STEPS.find((s) => s * 3 >= peak) ?? Math.ceil(peak / 3 / 100) * 100
  return step * 3
}

export const loadTrendTicks = (yMax: number): number[] => [yMax / 3, (yMax * 2) / 3, yMax]

export function loadTrendView(pairs: LoadPair[], window: DayWindow, yMax: number): LoadTrendView | null {
  const inWindow = pairs.filter((p) => p.date >= window.start && p.date <= window.end)
  const last = inWindow.at(-1)
  if (!last || inWindow.length < 2) return null

  const daily = inWindow.map((p) => {
    const { lo, hi } = safeRange(p.chronic)
    return { date: p.date, acute: p.acute, lo, hi, out: p.acute > 0 && (p.acute < lo || p.acute > hi) }
  })
  const points = weekly(window)
    ? byWeek(daily).map((week) => {
        const acute = Math.round(mean(week.map((p) => p.acute)))
        const lo = Math.round(mean(week.map((p) => p.lo)))
        const hi = Math.round(mean(week.map((p) => p.hi)))
        return { date: week.at(-1)!.date, acute, lo, hi, out: acute > 0 && (acute < lo || acute > hi) }
      })
    : daily

  const { lo, hi } = safeRange(last.chronic)
  const overDays = daily.slice(0, -1).filter((p) => p.acute > p.hi)
  return {
    points,
    last,
    acute: last.acute,
    lo,
    hi,
    state: stateOf(last.acute, lo, hi),
    ratio: loadRatio(last),
    change: loadChange(pairs, last),
    over: overDays.length ? { days: overDays.length, last: overDays.at(-1)!.date } : null,
    yMax,
    ticks: loadTrendTicks(yMax),
  }
}

// ─── Recovery ──────────────────────────────────────────────────────────────

/**
 * Under this many days of a series in the window, that series is left out;
 * with neither, the card is hidden, never drawn empty. A watch not worn
 * overnight records no HRV at all, but still a daytime resting HR.
 */
export const RECOVERY_MIN_NIGHTS = 7
/** The baseline is the athlete's own range over the last 60 nights. */
export const BASELINE_NIGHTS = 60
/** Changes inside these read as no real change (v4.7 rule). */
export const HRV_FLAT_MS = 3
export const RESTING_HR_FLAT_BPM = 2

export interface RecoverySeries {
  /** One value per chart date; null where the watch recorded nothing. */
  values: (number | null)[]
  outside: boolean[]
  lo: number
  hi: number
  now: number
  /** Last night against the 7 nights before it, whole units. */
  delta: number | null
  tone: DeltaTone
  /** Last night sat outside the baseline, and on which side. */
  side: 'low' | 'high' | null
  yMin: number
  yMax: number
}

export interface RecoveryView {
  dates: string[]
  hrv: RecoverySeries | null
  restingHr: RecoverySeries | null
  /** Nights in a row, up to last night, with HRV below baseline. */
  hrvLowStreak: number
  out: boolean
}

function quantile(sorted: number[], q: number): number {
  const at = (sorted.length - 1) * q
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo)
}

/**
 * The baseline: the middle 80% of the athlete's own last 60 nights before
 * last night, so last night is judged against what came before it rather
 * than against itself.
 */
function baseline(values: { date: string; v: number }[], lastDate: string): { lo: number; hi: number } | null {
  const from = isoDate(addDays(day(lastDate), -BASELINE_NIGHTS))
  const sample = values.filter((x) => x.date >= from && x.date < lastDate).map((x) => x.v).sort((a, b) => a - b)
  if (sample.length < RECOVERY_MIN_NIGHTS) return null
  return { lo: Math.round(quantile(sample, 0.1)), hi: Math.round(quantile(sample, 0.9)) }
}

function series(
  nights: RecoveryNight[],
  pick: (n: RecoveryNight) => number | null,
  window: DayWindow,
  metric: 'hrv' | 'restingHr',
  flat: number,
): { series: RecoverySeries; dates: string[]; raw: { date: string; v: number }[] } | null {
  const all = nights.flatMap((n) => (pick(n) !== null ? [{ date: n.date, v: pick(n)! }] : []))
  const inWindow = all.filter((x) => x.date >= window.start && x.date <= window.end)
  const last = inWindow.at(-1)
  if (!last) return null
  const band = baseline(all, last.date)
  if (!band) return null

  const weekFrom = isoDate(addDays(day(last.date), -7))
  const week = all.filter((x) => x.date >= weekFrom && x.date < last.date).map((x) => x.v)
  const delta = week.length ? Math.round(last.v - mean(week)) : null
  const tone: DeltaTone = deltaTone(metric, delta, { flatBelow: flat })

  const points = weekly(window)
    ? byWeek(inWindow).map((w) => ({ date: w.at(-1)!.date, v: Math.round(mean(w.map((x) => x.v))) }))
    : inWindow
  const values = points.map((p) => p.v)
  const span = Math.max(...values, band.hi) - Math.min(...values, band.lo) || 1
  return {
    raw: inWindow,
    dates: points.map((p) => p.date),
    series: {
      values,
      outside: values.map((v) => v < band.lo || v > band.hi),
      lo: band.lo,
      hi: band.hi,
      now: last.v,
      delta,
      tone,
      side: last.v < band.lo ? 'low' : last.v > band.hi ? 'high' : null,
      yMin: Math.min(...values, band.lo) - span * 0.15,
      yMax: Math.max(...values, band.hi) + span * 0.15,
    },
  }
}

/** Align a series onto the chart's dates, null where it has no point. */
function onDates(dates: string[], own: string[], s: RecoverySeries): RecoverySeries {
  const at = new Map(own.map((d, i) => [d, i]))
  const index = dates.map((d) => at.get(d))
  return {
    ...s,
    values: index.map((i) => (i === undefined ? null : s.values[i]!)),
    outside: index.map((i) => (i === undefined ? false : s.outside[i]!)),
  }
}

function enough(nights: RecoveryNight[], pick: (n: RecoveryNight) => number | null, window: DayWindow): boolean {
  return nights.filter((n) => pick(n) !== null && n.date >= window.start && n.date <= window.end).length >= RECOVERY_MIN_NIGHTS
}

export function recoveryView(nights: RecoveryNight[], window: DayWindow): RecoveryView | null {
  const hrvOf = (n: RecoveryNight) => n.hrv
  const rhrOf = (n: RecoveryNight) => n.restingHr
  const hrv = enough(nights, hrvOf, window) ? series(nights, hrvOf, window, 'hrv', HRV_FLAT_MS) : null
  const rhr = enough(nights, rhrOf, window) ? series(nights, rhrOf, window, 'restingHr', RESTING_HR_FLAT_BPM) : null
  if (!hrv && !rhr) return null

  const dates = [...new Set([...(hrv?.dates ?? []), ...(rhr?.dates ?? [])])].sort()
  let hrvLowStreak = 0
  if (hrv) for (let i = hrv.raw.length - 1; i >= 0 && hrv.raw[i]!.v < hrv.series.lo; i--) hrvLowStreak++

  return {
    dates,
    hrv: hrv ? onDates(dates, hrv.dates, hrv.series) : null,
    restingHr: rhr ? onDates(dates, rhr.dates, rhr.series) : null,
    hrvLowStreak,
    // Only the bad side is a flag (App Fixes 2a): a resting HR below its
    // baseline is a recovered athlete, and HRV above it is the same news.
    // Both used to raise "Recovery is dipping" over a number that had
    // improved.
    out: hrv?.series.side === 'low' || rhr?.series.side === 'high',
  }
}

// ─── Coach read (v5.4) ─────────────────────────────────────────────────────

export type LoadCoachHeadline =
  | { kind: 'spikeAndDip' }
  | { kind: 'spike'; change: LoadChange | null }
  | { kind: 'dip' }
  | { kind: 'building'; change: LoadChange; recovery: boolean }

/**
 * The coach read's headline once load and recovery are known; first match
 * wins. Null leaves the speed-based headline in place: the load is not up and
 * nothing is out of range.
 */
export function loadCoachHeadline(load: LoadTrendView | null, recovery: RecoveryView | null): LoadCoachHeadline | null {
  const above = load?.state === 'above'
  if (above && recovery?.out) return { kind: 'spikeAndDip' }
  if (above) return { kind: 'spike', change: load!.change && load!.change.pct > 0 ? load!.change : null }
  if (recovery?.out) return { kind: 'dip' }
  if (load?.state === 'in' && load.change && load.change.pct > 0) return { kind: 'building', change: load.change, recovery: recovery !== null }
  return null
}
