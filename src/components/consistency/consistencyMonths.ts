import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { formatDate, formatDateRange } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * A day as the grid draws it: rest, run or long run; `future` for the rest of
 * the current month; `none` for a day the data doesn't reach.
 */
export type DayState = 'rest' | 'run' | 'long' | 'future' | 'none'

/**
 * The one consistency scale (v5.5 R2), on the Progress card and the page:
 * neutral, because a day run is data and the accent is for "now". Rest the
 * faint track, a run the band grey, a long run ink; today an accent outline.
 */
export const DAY_FILL = { rest: 'var(--track)', run: 'var(--band)', long: 'var(--foreground)' } as const
export const TODAY_OUTLINE = '0 0 0 1.5px var(--accent)'

export interface ConsistencyCell {
  date: string
  state: DayState
  today: boolean
  /** The day's longest run, which a tap opens. */
  activityId: string | null
}

export interface ConsistencyMonth {
  /** YYYY-MM */
  key: string
  /** The month's initial, over its column. */
  initial: string
  /** Long month and year, for the column's accessible name. */
  fullLabel: string
  /** January is the year's first column, set in text ink. */
  startsYear: boolean
  /** 31 rows, day 1 first; `null` where the month has no such day (Feb 30). */
  cells: (ConsistencyCell | null)[]
  activeDays: number
}

export interface ConsistencyView {
  months: ConsistencyMonth[]
  activeDays: number
  /** Days in the window up to today. */
  windowDays: number
  /** Share of the window's days with a run, 0–100. */
  sharePct: number
  streakWeeks: number
  range: string | null
}

export const MONTHS_SHOWN = 12
export const ROWS = 31
/** The rows that carry a day number. */
export const LABELLED_ROWS = [1, 8, 15, 22, 29]

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function monthKeyBack(todayIso: string, back: number): string {
  const [year, month] = todayIso.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(year, month - 1 - back, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function stateOf(day: HeatmapDay): DayState {
  if (day.sessionCount === 0) return 'rest'
  return day.longRun ? 'long' : 'run'
}

/**
 * The rolling year as twelve month columns, oldest on the left, and 31 day
 * rows (C1, v4.4): each month is a column a thumb can follow down, and a
 * short month leaves its missing days out rather than drawing them as rest.
 * The current month is partial: the days after today are outlined, still
 * to come.
 */
export function consistencyMonths(days: HeatmapDay[], today: string, streakWeeks = 0): ConsistencyView {
  const byDate = new Map(days.filter((day) => day.date).map((day) => [day.date, day]))
  const narrow = new Intl.DateTimeFormat(t.locale, { month: 'narrow', timeZone: 'UTC' })

  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => monthKeyBack(today, MONTHS_SHOWN - 1 - i)).map(
    (key): ConsistencyMonth => {
      const [year, month] = key.split('-').map(Number) as [number, number]
      const length = daysInMonth(year, month)
      const cells = Array.from({ length: ROWS }, (_, i): ConsistencyCell | null => {
        if (i >= length) return null
        const date = `${key}-${String(i + 1).padStart(2, '0')}`
        if (date > today) return { date, state: 'future', today: false, activityId: null }
        const day = byDate.get(date)
        return {
          date,
          state: day ? stateOf(day) : 'none',
          today: date === today,
          activityId: day?.activityId ?? null,
        }
      })
      return {
        key,
        initial: narrow.format(new Date(Date.UTC(year, month - 1, 1))),
        fullLabel: formatDate(`${key}-01`, { precision: 'month', year: 'always' }),
        startsYear: month === 1,
        cells,
        activeDays: cells.filter((cell) => cell?.state === 'run' || cell?.state === 'long').length,
      }
    },
  )

  const counted = months.flatMap((month) => month.cells).filter((cell): cell is ConsistencyCell => !!cell && (cell.state === 'rest' || cell.state === 'run' || cell.state === 'long'))
  const activeDays = counted.filter((cell) => cell.state !== 'rest').length
  const first = months[0]!.key

  return {
    months,
    activeDays,
    windowDays: counted.length,
    sharePct: counted.length > 0 ? Math.round((activeDays / counted.length) * 100) : 0,
    streakWeeks,
    range: activeDays > 0 ? formatDateRange(`${first}-01`, today, { precision: 'month', year: 'always' }) : null,
  }
}
