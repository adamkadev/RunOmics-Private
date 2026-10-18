import type { CSSProperties } from 'react'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { formatDate, formatDateRange, formatDistance } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * A day's distance as a step of the accent ramp (v4.17): rest, under 8 km,
 * 8 to 15 km, and a long day of 15 km and more.
 */
export type DayLevel = 0 | 1 | 2 | 3

/** Where the ramp steps up: 8 km, and 15 km for a long day. */
export const LEVEL_KM = { mid: 8, long: 15 } as const

export function dayLevel(day: Pick<HeatmapDay, 'distanceKm' | 'sessionCount'> | undefined): DayLevel {
  if (!day || day.sessionCount === 0) return 0
  return day.distanceKm >= LEVEL_KM.long ? 3 : day.distanceKm >= LEVEL_KM.mid ? 2 : 1
}

/**
 * The one consistency ramp, on the Progress card, this page and its month
 * bars (v4.17.1): a day run is the athlete's own data, so it is the accent -
 * 35%, 65%, full in dark; 25%, 55%, full in light - on the rest fill.
 */
export const LEVEL_FILL: Record<DayLevel, string> = {
  0: 'var(--level-rest)',
  1: 'color-mix(in srgb, var(--accent) var(--level-low), transparent)',
  2: 'color-mix(in srgb, var(--accent) var(--level-mid), transparent)',
  3: 'var(--accent)',
}

/** A month with this many active days or more is the full accent; fewer, the ramp's lowest tint. */
export const STRONG_MONTH_DAYS = 16

/** Today, outlined in the accent a pixel off its cell. */
export const TODAY_OUTLINE: CSSProperties = { outline: '1.5px solid var(--accent)', outlineOffset: 1 }
/** A day still to come: a dashed line and no fill. */
export const FUTURE_OUTLINE: CSSProperties = { outline: '1px dashed var(--border)', outlineOffset: 1, background: 'transparent' }

/** A cell's fill, outline included. */
export function levelStyle(level: DayLevel, { today = false, future = false }: { today?: boolean; future?: boolean } = {}): CSSProperties {
  if (future) return FUTURE_OUTLINE
  return { background: LEVEL_FILL[level], ...(today ? TODAY_OUTLINE : {}) }
}

/**
 * A day as the calendar draws it: rest or a run (its level says how far);
 * `future` for a day still to come; `none` for a day before the window or one
 * the data doesn't reach.
 */
export type DayState = 'rest' | 'run' | 'future' | 'none'

export interface ConsistencyCell {
  date: string
  state: DayState
  level: DayLevel
  km: number
  today: boolean
  /** The day's longest run, which a tap opens. */
  activityId: string | null
}

export interface ConsistencyWeek {
  /** The Monday. */
  start: string
  /** The short month name, on the column where a month starts; null elsewhere. */
  monthLabel: string | null
  /** Monday to Sunday. */
  days: ConsistencyCell[]
}

export interface ConsistencyMonth {
  /** YYYY-MM */
  key: string
  /** "Oct", under its bar. */
  label: string
  /** Long month and year, for the bar's accessible name. */
  fullLabel: string
  activeDays: number
  /** The month's days up to today: all of them, or the days so far. */
  days: number
  /** The month under way: its count is not a month's yet, so it is neither strong nor weak. */
  inProgress: boolean
}

export interface ConsistencyView {
  /** The rolling year as week columns, Monday on top (v4.17). */
  weeks: ConsistencyWeek[]
  /** The same twelve months, for the active days per month. */
  months: ConsistencyMonth[]
  activeDays: number
  /** Days in the window up to today. */
  windowDays: number
  /** The window's first day: the first of the month eleven months back. */
  windowStart: string
  /** Share of the window's days with a run, 0–100. */
  sharePct: number
  streakWeeks: number
  bestStreakWeeks: number | null
  /**
   * The share over the twelve months before, where the history reaches them:
   * a history that starts inside that year is compared over the part it
   * covers, and says which.
   */
  prior: { sharePct: number; deltaPts: number; fullYear: boolean; range: string; months: number } | null
  range: string | null
}

export const MONTHS_SHOWN = 12
/** Under this many days of history, the year before has no share worth comparing. */
const MIN_PRIOR_DAYS = 28

const DAY = 86_400_000

function utc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function plusDays(date: string, n: number): string {
  return iso(utc(date) + n * DAY)
}

function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY) + 1
}

/** The Monday on or before a date. */
function mondayOf(date: string): string {
  const weekday = new Date(utc(date)).getUTCDay() || 7
  return plusDays(date, 1 - weekday)
}

function monthStartBack(todayIso: string, back: number): string {
  const [year, month] = todayIso.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(year, month - 1 - back, 1))
  return iso(d.getTime())
}

function monthEnd(key: string): string {
  const [year, month] = key.split('-').map(Number) as [number, number]
  return iso(Date.UTC(year, month, 0))
}

export interface ConsistencyOptions {
  streakWeeks?: number
  /** The longest run of active weeks there has been. */
  bestStreakWeeks?: number | null
  /** Every run's date, for the year before the window. */
  runDates?: readonly string[]
}

/**
 * The rolling year - the twelve calendar months to this one - as GitHub-style
 * week columns (v4.17), Monday on top, every day on the accent ramp by its
 * distance. The days after today are still to come; the days before the
 * window's first month are left blank. The months are counted too, for the
 * active days per month under it.
 */
export function consistencyMonths(days: HeatmapDay[], today: string, options: ConsistencyOptions = {}): ConsistencyView {
  const { streakWeeks = 0, bestStreakWeeks = null, runDates = [] } = options
  const byDate = new Map(days.filter((day) => day.date).map((day) => [day.date, day]))
  const short = new Intl.DateTimeFormat(t.locale, { month: 'short', timeZone: 'UTC' })
  const shortMonth = (date: string) => short.format(new Date(utc(date))).replace(/\.$/, '')

  const windowStart = monthStartBack(today, MONTHS_SHOWN - 1)
  const windowEnd = monthEnd(today.slice(0, 7))

  const cellOf = (date: string): ConsistencyCell => {
    if (date < windowStart) return { date, state: 'none', level: 0, km: 0, today: false, activityId: null }
    if (date > today) return { date, state: 'future', level: 0, km: 0, today: false, activityId: null }
    const day = byDate.get(date)
    if (!day) return { date, state: 'none', level: 0, km: 0, today: date === today, activityId: null }
    const level = dayLevel(day)
    return { date, state: level > 0 ? 'run' : 'rest', level, km: day.distanceKm, today: date === today, activityId: day.activityId }
  }

  const weeks: ConsistencyWeek[] = []
  let labelled: string | null = null
  for (let start = mondayOf(windowStart); start <= windowEnd; start = plusDays(start, 7)) {
    // The first column is named for the window's first month, even when its
    // Monday falls in the month before.
    const month = weeks.length === 0 ? windowStart.slice(0, 7) : start.slice(0, 7)
    const monthLabel = month !== labelled ? shortMonth(`${month}-01`) : null
    labelled = month
    weeks.push({ start, monthLabel, days: Array.from({ length: 7 }, (_, d) => cellOf(plusDays(start, d))) })
  }

  const counted = weeks.flatMap((week) => week.days).filter((cell) => cell.state === 'rest' || cell.state === 'run')
  const activeDays = counted.filter((cell) => cell.state === 'run').length
  const share = counted.length > 0 ? activeDays / counted.length : 0

  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => monthStartBack(today, MONTHS_SHOWN - 1 - i)).map(
    (first): ConsistencyMonth => {
      const key = first.slice(0, 7)
      const inMonth = counted.filter((cell) => cell.date.startsWith(key))
      return {
        key,
        label: shortMonth(first),
        fullLabel: formatDate(first, { precision: 'month', year: 'always' }),
        activeDays: inMonth.filter((cell) => cell.state === 'run').length,
        days: inMonth.length,
        inProgress: key === today.slice(0, 7),
      }
    },
  )

  return {
    weeks,
    months,
    activeDays,
    windowDays: counted.length,
    windowStart,
    sharePct: Math.round(share * 100),
    streakWeeks,
    bestStreakWeeks,
    prior: priorShare(runDates, windowStart, share),
    range: activeDays > 0 ? formatDateRange(windowStart, today, { precision: 'month', year: 'always' }) : null,
  }
}

/** The share of days with a run over the twelve months before `windowStart`, as far as the history reaches. */
function priorShare(runDates: readonly string[], windowStart: string, share: number): ConsistencyView['prior'] {
  const dates = new Set(runDates.map((date) => date.slice(0, 10)))
  if (dates.size === 0) return null
  const first = [...dates].sort()[0]!
  const [year, month] = windowStart.split('-').map(Number) as [number, number]
  const priorStart = iso(Date.UTC(year - 1, month - 1, 1))
  const priorEnd = plusDays(windowStart, -1)
  const from = first > priorStart ? first : priorStart
  if (from > priorEnd || daysBetween(from, priorEnd) < MIN_PRIOR_DAYS) return null

  const covered = daysBetween(from, priorEnd)
  const active = [...dates].filter((date) => date >= from && date <= priorEnd).length
  const priorShareValue = active / covered
  return {
    sharePct: Math.round(priorShareValue * 100),
    deltaPts: Math.round((share - priorShareValue) * 100),
    fullYear: from === priorStart,
    range: formatDateRange(from, priorEnd, { precision: 'month', year: 'always' }),
    // "−7 pts vs May – Oct 2025" wrapped over three lines in a third of a phone.
    months: Math.max(1, Math.round(covered / 30.44)),
  }
}

/** A day's accessible name: "Wed, Sep 24: 8.6 km", or "…: Rest". */
export function dayName(cell: ConsistencyCell): string {
  const c = t.consistency
  const what = cell.state === 'run' ? `${formatDistance(cell.km)} ${t.units.km}` : cell.state === 'future' ? c.toCome : c.levels.rest
  return `${formatDate(cell.date)}: ${what}`
}
