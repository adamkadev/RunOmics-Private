import { DAY_MS } from '@/lib/calendarDate'
import { median } from '@/lib/math'
import { heatPenalty } from '@/domain/activity/heat'

export const CYCLE_WEEKS = 12
const CYCLE_DAYS = CYCLE_WEEKS * 7

export interface DateWindow {
  start: string
  end: string
}

/** coach: counted from the coach's macrocycle start. rolling: no plan to count from, so the last 12 complete weeks. */
export type CycleMode = 'coach' | 'rolling'

export interface CheckpointCycle {
  mode: CycleMode
  number: number | null
  week: number
  complete: boolean
  current: DateWindow
  previous: DateWindow
  /** The last day the current cycle is read to: today while it runs, its last day once it is over. */
  asOf: string
  /** Monday-to-Sunday weeks of the current cycle already over: every per-week rate divides by these. */
  completeWeeks: number
}

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS)
const fromDayNumber = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10)

export const shiftDays = (iso: string, days: number) => fromDayNumber(dayNumber(iso) + days)
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from)

// Day 0 is a Thursday, so a Monday sits three days into the week count.
export const mondayOf = (iso: string) => {
  const day = dayNumber(iso)
  return fromDayNumber(day - ((day + 3) % 7))
}

const previousOf = (window: DateWindow): DateWindow => ({ start: shiftDays(window.start, -CYCLE_DAYS), end: shiftDays(window.start, -1) })

/** Monday weeks from the anchor's Monday, as Plan counts them; a cycle just ended stays under review for a week. */
export function checkpointCycle(anchor: string | null, today: string): CheckpointCycle {
  const start = anchor ? mondayOf(anchor) : null
  if (!start || start > today) {
    const end = shiftDays(mondayOf(today), -1)
    const current = { start: shiftDays(end, 1 - CYCLE_DAYS), end }
    return { mode: 'rolling', number: null, week: CYCLE_WEEKS, complete: true, current, previous: previousOf(current), asOf: end, completeWeeks: CYCLE_WEEKS }
  }
  const index = Math.floor(daysBetween(start, today) / CYCLE_DAYS)
  const cycleStart = shiftDays(start, index * CYCLE_DAYS)
  const week = Math.floor(daysBetween(cycleStart, today) / 7) + 1
  if (week === 1 && index > 0) {
    const current = { start: shiftDays(cycleStart, -CYCLE_DAYS), end: shiftDays(cycleStart, -1) }
    return { mode: 'coach', number: index, week: CYCLE_WEEKS, complete: true, current, previous: previousOf(current), asOf: current.end, completeWeeks: CYCLE_WEEKS }
  }
  const current = { start: cycleStart, end: shiftDays(cycleStart, CYCLE_DAYS - 1) }
  return { mode: 'coach', number: index + 1, week, complete: false, current, previous: previousOf(current), asOf: today, completeWeeks: week - 1 }
}

/** The days a per-week rate counts: whole weeks only, so a Monday morning never reads as a light week. */
export function ratedWindow(window: DateWindow, completeWeeks: number): DateWindow | null {
  return completeWeeks > 0 ? { start: window.start, end: shiftDays(window.start, completeWeeks * 7 - 1) } : null
}

export const inWindow = (date: string, window: DateWindow) => date.slice(0, 10) >= window.start && date.slice(0, 10) <= window.end

/** The latest reading on or before a date: Garmin's estimates hold until the watch revises them. */
export function readingOn<T extends { date: string }>(samples: readonly T[], date: string): T | null {
  let latest: T | null = null
  for (const sample of samples) {
    if (sample.date <= date && (!latest || sample.date >= latest.date)) latest = sample
  }
  return latest
}

export interface EasyRunSample {
  date: string
  paceSecPerKm: number
  hr: number
  apparentTempC: number | null
}

/** Easy runs this close to the reference pace are the ones compared: a fit across all paces swung with every hill. */
export const EASY_PACE_BAND_SEC = 10
export const MIN_EASY_RUNS = 3

/** The pace both cycles are read at: their easy runs' median, to the nearest 5 s. */
export function referenceEasyPace(runs: readonly EasyRunSample[]): number | null {
  return runs.length >= MIN_EASY_RUNS ? Math.round(median(runs.map((run) => run.paceSecPerKm)) / 5) * 5 : null
}

/** The app's heat model, applied to heart rate: the same discount heatAdjustedEf gives efficiency. */
export const heatAdjustedHr = (run: EasyRunSample) => (run.apparentTempC === null ? run.hr : run.hr / (1 + heatPenalty(run.apparentTempC)))

export function easyHrAtPace(runs: readonly EasyRunSample[], paceSecPerKm: number): number | null {
  const near = runs.filter((run) => Math.abs(run.paceSecPerKm - paceSecPerKm) <= EASY_PACE_BAND_SEC)
  return near.length >= MIN_EASY_RUNS ? Math.round(median(near.map(heatAdjustedHr))) : null
}
