import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { round } from '@/lib/math'
import type { Activity } from '@/domain/activity/types'
import { trimp, DEFAULT_HR_BOUNDS, type HrBounds } from '@/domain/training/trimp'
import { ATL_DAYS, type LoadSnapshot } from '@/domain/training/taper'
import { loadSeries } from '@/domain/training/loadSeries'
import { appTodayIso } from '@/lib/calendarDate'

export { trimp, type HrBounds }
export { ATL_DAYS, type LoadSnapshot }

const MAX_DAYS = 1095

export interface TrainingLoadPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
}

export interface TrainingLoadData {
  points: TrainingLoadPoint[]
  ctl: number
  atl: number
  tsb: number
  tsbNow: number
}

export function dailyTrimpByDate(activities: Activity[], hrBounds: HrBounds = DEFAULT_HR_BOUNDS): Map<string, number> {
  const dailyLoad = new Map<string, number>()
  for (const a of activities) {
    dailyLoad.set(a.date, (dailyLoad.get(a.date) ?? 0) + trimp(a, hrBounds))
  }
  return dailyLoad
}

// By the activity list, the same array until the data changes, then by bounds and day: a render reads it several times.
const seriesCache = new WeakMap<Activity[], Map<string, Map<string, LoadSnapshot>>>()

/** Shared between callers: read it, never change it. */
export function buildTimeSeries(activities: Activity[], hrBounds: HrBounds = DEFAULT_HR_BOUNDS): Map<string, LoadSnapshot> {
  const today = appTodayIso()
  const key = `${hrBounds.maxHr}|${hrBounds.restingHr}|${today}`
  let byKey = seriesCache.get(activities)
  if (!byKey) seriesCache.set(activities, (byKey = new Map()))
  let series = byKey.get(key)
  if (!series) byKey.set(key, (series = timeSeries(activities, hrBounds, today)))
  return series
}

function timeSeries(activities: Activity[], hrBounds: HrBounds, today: string): Map<string, LoadSnapshot> {
  const series = new Map<string, LoadSnapshot>()
  const first = activities.reduce<string | null>((min, a) => (min === null || a.date < min ? a.date : min), null)
  if (!first) return series

  for (const [date, day] of loadSeries(dailyTrimpByDate(activities, hrBounds), first, today)) {
    series.set(date, { ctl: round(day.ctl), atl: round(day.atl), tsb: round(day.tsb) })
  }
  return series
}

export async function getTrainingLoad(): Promise<TrainingLoadData | null> {
  const activities = getAllActivities()
  if (!activities.length) return null

  const athlete = getAthleteProfile()
  const hrBounds: HrBounds = {
    maxHr: athlete.maxHrBpm ?? DEFAULT_HR_BOUNDS.maxHr,
    restingHr: athlete.restingHrBpm ?? DEFAULT_HR_BOUNDS.restingHr,
  }

  const series = buildTimeSeries(activities, hrBounds)
  const entries = Array.from(series.entries())
  const window = entries.slice(-MAX_DAYS)

  const points: TrainingLoadPoint[] = window.map(([date, snap]) => ({ date, ...snap }))

  const last = points[points.length - 1]
  if (!last) return null
  return { points, ctl: last.ctl, atl: last.atl, tsb: last.tsb, tsbNow: round(last.ctl - last.atl) }
}
