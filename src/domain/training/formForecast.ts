import { DAY_MS } from '@/lib/calendarDate'
import { round } from '@/lib/math'
import { firstRunBack } from './buildingBack'
import { loadSeries } from './loadSeries'
import { CTL_DAYS } from './taper'

/** The planned sessions must reach this close to race day, or the forecast would read the gap after them as a taper. */
export const PLAN_REACH_DAYS = 7
export const FORECAST_HISTORY_DAYS = 28

export interface FormPoint {
  date: string
  tsb: number
  planned: boolean
}

export type FormForecast =
  | { kind: 'forecast'; raceDay: { ctl: number; atl: number; tsb: number }; tsbToday: number; points: FormPoint[] }
  /** Fitness is a 42-day average: fewer days of running since the first run or the last long break leave it unread. */
  | { kind: 'shortHistory'; runningDays: number; neededDays: number }
  | { kind: 'planShort'; plannedThrough: string | null }

export interface FormForecastInput {
  /** Each day's load from the runs done, through today. */
  dailyLoad: ReadonlyMap<string, number>
  runDates: readonly string[]
  planned: readonly { date: string; load: number }[]
  today: string
  raceDate: string
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

export function forecastForm({ dailyLoad, runDates, planned, today, raceDate }: FormForecastInput): FormForecast {
  const ran = runDates.filter((date) => date <= today).sort()
  const start = firstRunBack(ran) ?? ran[0] ?? null
  const runningDays = start ? daysBetween(start, today) : 0
  if (runningDays < CTL_DAYS || daysBetween(ran.at(-1)!, today) >= CTL_DAYS) {
    return { kind: 'shortHistory', runningDays: Math.max(0, runningDays), neededDays: CTL_DAYS }
  }

  // Today's session counts as planned until a run is synced for it.
  const ahead = planned.filter((p) => p.date < raceDate && (p.date > today || (p.date === today && !dailyLoad.has(today))))
  const plannedThrough = ahead.reduce<string | null>((last, p) => (last === null || p.date > last ? p.date : last), null)
  if (raceDate > today && (plannedThrough === null || daysBetween(plannedThrough, raceDate) > PLAN_REACH_DAYS || ahead.every((p) => p.load <= 0))) {
    return { kind: 'planShort', plannedThrough }
  }

  const loads = new Map(dailyLoad)
  for (const p of ahead) loads.set(p.date, (loads.get(p.date) ?? 0) + p.load)
  const series = loadSeries(loads, ran[0]!, raceDate)
  const race = series.get(raceDate)!
  const from = addDays(today, -FORECAST_HISTORY_DAYS)
  const points = Array.from(series, ([date, day]) => ({ date, tsb: round(day.tsb), planned: date > today })).filter((p) => p.date >= from)
  return {
    kind: 'forecast',
    raceDay: { ctl: round(race.ctl), atl: round(race.atl), tsb: round(race.tsb) },
    tsbToday: round(series.get(today)!.tsb),
    points,
  }
}
