import type { ConsistencyRun } from '@/application/usecases/GetConsistencyData'
import type { CrossTrainingEntry } from '@/domain/activity/crossTraining'
import { WEEKLY_RUN_TARGET } from '@/domain/training/weeklyRunTarget'

/** In the URL as ?range=. */
export type ConsistencyRange = '3m' | '6m' | '1y'
export const CONSISTENCY_RANGES: readonly ConsistencyRange[] = ['3m', '6m', '1y']
export const DEFAULT_RANGE: ConsistencyRange = '6m'
/** The weeks done each window counts, the week under way drawn after them. */
export const RANGE_WEEKS: Record<ConsistencyRange, number> = { '3m': 13, '6m': 26, '1y': 52 }

export function parseRange(value: string | null | undefined): ConsistencyRange {
  return CONSISTENCY_RANGES.find((range) => range === value) ?? DEFAULT_RANGE
}

const REST_DAY_SHARE = 0.1

export interface ConsistencyWeek {
  /** The Monday. */
  start: string
  runs: number
  km: number
  seconds: number
  /** Sessions still to come in the week under way; 0 for a week done. */
  planned: number
  /** Other-training sessions, beside the runs and never counted as one. */
  others: number
  current: boolean
  onTarget: boolean
  inStreak: boolean
  /** YYYY-MM-01 of the month whose first day the week holds, when it is named under the chart; null otherwise. */
  month: string | null
}

export interface ConsistencyView {
  range: ConsistencyRange
  target: number
  /** The window's weeks done, oldest first, then the week under way. */
  weeks: ConsistencyWeek[]
  /** Weeks done in the window: from the first run's week when the history is shorter. */
  weeksCounted: number
  weeksOnTarget: number
  runs: number
  /** Runs a week over the weeks done, to one decimal. */
  runsPerWeek: number
  streakWeeks: number
  bestStreakWeeks: number
  thisWeek: { runs: number; planned: number }
  /** Weeks done with a run on each weekday, Monday first. */
  weekdays: number[]
  /** The weekday run most often (0 is Monday); null with no runs. */
  anchor: number | null
  /** The weekday run least often, when it is run in a tenth of the weeks or fewer; null otherwise. */
  restDay: number | null
  /** Runs a day, from the first day a tapped week's month can show to today. */
  runDays: Record<string, number>
  /** Days with a session still to come, from today. */
  plannedDates: string[]
  /** Other-training sessions from the first day a tapped week's month can show to today, oldest first. */
  others: CrossTrainingEntry[]
}

export interface ConsistencyInput {
  runs: readonly ConsistencyRun[]
  others?: readonly CrossTrainingEntry[]
  today: string
  streakWeeks: number
  bestStreakWeeks: number
  /** Days with a session still to come and not yet run, from today. */
  plannedDates?: readonly string[]
}

const DAY = 86_400_000

function utc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function plusDays(date: string, n: number): string {
  return iso(utc(date) + n * DAY)
}

/** The Monday on or before a date. */
export function mondayOf(date: string): string {
  const weekday = new Date(utc(date)).getUTCDay() || 7
  return plusDays(date, 1 - weekday)
}

/** Monday is 0, Sunday 6. */
function weekdayOf(date: string): number {
  return ((new Date(utc(date)).getUTCDay() || 7) - 1)
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function consistencyView(range: ConsistencyRange, input: ConsistencyInput): ConsistencyView {
  const { today, streakWeeks, bestStreakWeeks } = input
  const target = WEEKLY_RUN_TARGET
  const runs = input.runs.filter((run) => run.date && run.date <= today)
  const current = mondayOf(today)
  const first = runs.reduce<string | null>((min, run) => (!min || run.date < min ? run.date : min), null)

  const empty: ConsistencyView = {
    range, target, weeks: [], weeksCounted: 0, weeksOnTarget: 0, runs: 0, runsPerWeek: 0, streakWeeks, bestStreakWeeks,
    thisWeek: { runs: 0, planned: 0 }, weekdays: [0, 0, 0, 0, 0, 0, 0], anchor: null, restDay: null, runDays: {}, plannedDates: [], others: [],
  }
  if (!first) return empty

  const windowStart = plusDays(current, -7 * RANGE_WEEKS[range])
  const firstWeek = mondayOf(first) > windowStart ? mondayOf(first) : windowStart

  const byWeek = new Map<string, { runs: number; km: number; seconds: number; days: Set<string> }>()
  const runDays: Record<string, number> = {}
  const daysFrom = mondayOf(monthStart(firstWeek))
  for (const run of runs) {
    if (run.date >= daysFrom) runDays[run.date] = (runDays[run.date] ?? 0) + 1
    const week = mondayOf(run.date)
    if (week < firstWeek) continue
    const entry = byWeek.get(week) ?? { runs: 0, km: 0, seconds: 0, days: new Set<string>() }
    entry.runs += 1
    entry.km += run.distanceKm
    entry.seconds += run.durationSeconds
    entry.days.add(run.date)
    byWeek.set(week, entry)
  }

  const others = (input.others ?? []).filter((entry) => entry.date >= daysFrom && entry.date <= today).sort((a, b) => a.date.localeCompare(b.date))
  const othersByWeek = new Map<string, number>()
  for (const entry of others) othersByWeek.set(mondayOf(entry.date), (othersByWeek.get(mondayOf(entry.date)) ?? 0) + 1)

  const plannedDates = (input.plannedDates ?? []).filter((date) => date >= today)
  const weeks: ConsistencyWeek[] = []
  // A year names every other month: twelve labels crowd 52 narrow columns.
  const labelEvery = range === '1y' ? 2 : 1
  let labels = 0
  for (let start = firstWeek; start <= current; start = plusDays(start, 7)) {
    const entry = byWeek.get(start)
    const isCurrent = start === current
    const end = plusDays(start, 6)
    const firstOfMonth = start.endsWith('-01') ? start : end.slice(0, 7) !== start.slice(0, 7) ? monthStart(end) : null
    const month = firstOfMonth !== null && labels++ % labelEvery === 0 ? firstOfMonth : null
    weeks.push({
      start,
      runs: entry?.runs ?? 0,
      km: Math.round((entry?.km ?? 0) * 10) / 10,
      seconds: entry?.seconds ?? 0,
      planned: isCurrent ? plannedDates.filter((date) => date <= end).length : 0,
      others: othersByWeek.get(start) ?? 0,
      current: isCurrent,
      onTarget: (entry?.runs ?? 0) >= target,
      inStreak: false,
      month,
    })
  }

  // The streak's weeks end with this one once it is on target, else with last week's.
  let last = weeks.at(-1)!.onTarget ? weeks.length - 1 : weeks.length - 2
  for (let n = 0; n < streakWeeks && last >= 0 && weeks[last]!.onTarget; n++, last--) weeks[last]!.inStreak = true

  const done = weeks.filter((week) => !week.current)
  const doneRuns = done.reduce((sum, week) => sum + week.runs, 0)
  const weekdays = [0, 0, 0, 0, 0, 0, 0]
  for (const week of done) for (const date of byWeek.get(week.start)?.days ?? []) weekdays[weekdayOf(date)]! += 1

  const most = Math.max(...weekdays)
  const least = Math.min(...weekdays)
  const anchor = most > 0 ? weekdays.indexOf(most) : null
  const restDay = anchor !== null && least < most && least <= done.length * REST_DAY_SHARE ? weekdays.indexOf(least) : null

  const thisWeek = weeks.at(-1)!
  return {
    range,
    target,
    weeks,
    weeksCounted: done.length,
    weeksOnTarget: done.filter((week) => week.onTarget).length,
    runs: doneRuns,
    runsPerWeek: done.length > 0 ? Math.round((doneRuns / done.length) * 10) / 10 : 0,
    streakWeeks,
    bestStreakWeeks,
    thisWeek: { runs: thisWeek.runs, planned: thisWeek.planned },
    weekdays,
    anchor,
    restDay,
    runDays,
    plannedDates,
    others,
  }
}

export type WeekStatus = 'hit' | 'under' | 'current' | 'future'

function weekStatus(start: string, runs: number, target: number, current: string): WeekStatus {
  if (start > current) return 'future'
  if (runs >= target) return 'hit'
  return start === current ? 'current' : 'under'
}

export interface SheetDay {
  date: string
  /** The day of the month. */
  day: number
  /** In the month the sheet shows; the days either side are dimmed. */
  inMonth: boolean
  runs: number
  /** Other-training sessions: an active day of their own. */
  others: number
  today: boolean
  /** A session still to come. */
  planned: boolean
}

export interface SheetRow {
  start: string
  days: SheetDay[]
  runs: number
  status: WeekStatus
  selected: boolean
}

export interface WeekSheet {
  week: ConsistencyWeek
  status: Exclude<WeekStatus, 'future'>
  /** The month the calendar shows: the one the week's Monday is in. */
  month: string
  rows: SheetRow[]
}

export function weekSheet(view: ConsistencyView, weekStart: string, today: string): WeekSheet | null {
  const week = view.weeks.find((w) => w.start === weekStart)
  if (!week) return null
  const current = mondayOf(today)
  const planned = new Set(view.plannedDates)
  const othersByDay = new Map<string, number>()
  for (const entry of view.others) othersByDay.set(entry.date, (othersByDay.get(entry.date) ?? 0) + 1)
  const month = weekStart.slice(0, 7)
  const last = plusDays(monthStart(plusDays(`${month}-28`, 4)), -1)

  const rows: SheetRow[] = []
  for (let start = mondayOf(`${month}-01`); start <= last; start = plusDays(start, 7)) {
    const days = Array.from({ length: 7 }, (_, i): SheetDay => {
      const date = plusDays(start, i)
      return {
        date,
        day: Number(date.slice(8, 10)),
        inMonth: date.startsWith(month),
        runs: date <= today ? (view.runDays[date] ?? 0) : 0,
        others: othersByDay.get(date) ?? 0,
        today: date === today,
        planned: date >= today && planned.has(date),
      }
    })
    const runs = days.reduce((sum, day) => sum + day.runs, 0)
    rows.push({ start, days, runs, status: weekStatus(start, runs, view.target, current), selected: start === weekStart })
  }

  const status = weekStatus(week.start, week.runs, view.target, current)
  return { week, status: status === 'future' ? 'current' : status, month, rows }
}
