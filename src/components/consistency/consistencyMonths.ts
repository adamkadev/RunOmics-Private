import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { formatDate, formatDateRange, formatMonthShortYear } from '@/lib/formatters'

/** Three levels a phone can tell apart; `null` is a day outside the window. */
export type DayLevel = 'rest' | 'run' | 'long'

export interface ConsistencyMonth {
  /** YYYY-MM */
  key: string
  label: string
  /** Long month and year, for the row's accessible name. */
  fullLabel: string
  /** One per calendar day of the month, index 0 = the 1st. */
  cells: { date: string; level: DayLevel | null }[]
  activeDays: number
  longRuns: number
}

export interface ConsistencyView {
  months: ConsistencyMonth[]
  activeDays: number
  windowDays: number
  /** Share of the window's days with a run, 0–100. */
  sharePct: number
  range: string | null
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function levelOf(day: HeatmapDay): DayLevel {
  if (day.sessionCount === 0) return 'rest'
  return day.longRun ? 'long' : 'run'
}

/**
 * The rolling year as one row per month and one cell per day, portrait-sized:
 * the 53 × 7 grid drew each day at about 5 pt with two blues that read as one.
 * A month the window only partly covers leaves the days outside it blank
 * rather than drawing them as rest.
 */
export function consistencyMonths(days: HeatmapDay[]): ConsistencyView {
  const dated = days.filter((day) => day.date)
  const byDate = new Map(dated.map((day) => [day.date, day]))
  const monthKeys = [...new Set(dated.map((day) => day.date.slice(0, 7)))].sort()

  const months = monthKeys.map((key): ConsistencyMonth => {
    const [year, month] = key.split('-').map(Number) as [number, number]
    const cells = Array.from({ length: daysInMonth(year, month) }, (_, i) => {
      const date = `${key}-${String(i + 1).padStart(2, '0')}`
      const day = byDate.get(date)
      return { date, level: day ? levelOf(day) : null }
    })
    return {
      key,
      label: formatDate(`${key}-01`, { precision: 'month', year: 'never' }),
      fullLabel: formatDate(`${key}-01`, { precision: 'month', year: 'always' }),
      cells,
      activeDays: cells.filter((cell) => cell.level === 'run' || cell.level === 'long').length,
      longRuns: cells.filter((cell) => cell.level === 'long').length,
    }
  })

  // The first and last rows can be the same month a year apart: the older one
  // carries its year so the two never read as one.
  const lastLabel = months[months.length - 1]?.label
  for (const month of months.slice(0, -1)) {
    if (month.label === lastLabel) month.label = formatMonthShortYear(`${month.key}-01`)
  }

  const activeDays = dated.filter((day) => day.sessionCount > 0).length
  const first = dated[0]?.date
  const last = dated[dated.length - 1]?.date

  return {
    months,
    activeDays,
    windowDays: dated.length,
    sharePct: dated.length > 0 ? Math.round((activeDays / dated.length) * 100) : 0,
    range: first && last ? formatDateRange(first, last, { precision: 'month', year: 'always' }) : null,
  }
}
