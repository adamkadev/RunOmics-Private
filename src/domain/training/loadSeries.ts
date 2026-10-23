import { DAY_MS } from '@/lib/calendarDate'
import { ATL_DAYS, CTL_DAYS } from './taper'

export interface LoadDay {
  /** That day's training load (TRIMP). */
  load: number
  ctl: number
  atl: number
  /** Form at the start of the day, before its own load. */
  tsb: number
}

/**
 * The one model the app and the exported workbook share. Days are stepped as
 * calendar dates, so the series is the same in any time zone and across a clock
 * change. Unrounded: each reader rounds for its own display.
 */
export function loadSeries(dailyLoad: ReadonlyMap<string, number>, from: string, through: string): Map<string, LoadDay> {
  const series = new Map<string, LoadDay>()
  let ctl = 0
  let atl = 0
  for (const date of calendarDays(from, through)) {
    const load = dailyLoad.get(date) ?? 0
    const tsb = ctl - atl
    ctl += (load - ctl) / CTL_DAYS
    atl += (load - atl) / ATL_DAYS
    series.set(date, { load, ctl, atl, tsb })
  }
  return series
}

function calendarDays(from: string, through: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${through}T00:00:00Z`)
  const days: string[] = []
  for (let t = start; t <= end; t += DAY_MS) days.push(new Date(t).toISOString().slice(0, 10))
  return days
}
