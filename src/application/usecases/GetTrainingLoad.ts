import { t } from '@/i18n'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { round } from '@/lib/math'
import type { Activity } from '@/domain/activity/types'
import { trimp, DEFAULT_HR_BOUNDS, type HrBounds } from '@/domain/training/trimp'
import { CTL_DAYS, ATL_DAYS, type LoadSnapshot } from '@/domain/training/taper'
import { isoDate } from '@/lib/calendarDate'

export { trimp, type HrBounds }
export { ATL_DAYS, type LoadSnapshot }

const MAX_DAYS = 1095

export interface TrainingLoadPoint {
  date: string
  label: string
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

export function buildTimeSeries(activities: Activity[], hrBounds: HrBounds = DEFAULT_HR_BOUNDS): Map<string, LoadSnapshot> {
  const dailyLoad = dailyTrimpByDate(activities, hrBounds)

  const series = new Map<string, LoadSnapshot>()
  const firstAct = activities[activities.length - 1]
  if (!firstAct) return series
  const first = new Date(firstAct.date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let ctl = 0
  let atl = 0

  for (let d = new Date(first); d <= today; d.setDate(d.getDate() + 1)) {
    const date = isoDate(d)
    const tsb = ctl - atl
    const load = dailyLoad.get(date) ?? 0
    ctl += (load - ctl) / CTL_DAYS
    atl += (load - atl) / ATL_DAYS
    series.set(date, { ctl: round(ctl), atl: round(atl), tsb: round(tsb) })
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

  const points: TrainingLoadPoint[] = window.map(([date, snap]) => {
    const d = new Date(date + 'T00:00:00')
    return {
      date,
      label: d.toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }),
      ...snap,
    }
  })

  const last = points[points.length - 1]
  if (!last) return null
  return { points, ctl: last.ctl, atl: last.atl, tsb: last.tsb, tsbNow: round(last.ctl - last.atl) }
}
