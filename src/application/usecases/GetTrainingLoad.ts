import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { round } from '@/lib/math'
import type { Activity } from '@/domain/activity/types'

const MAX_HR = 195
const RESTING_HR = 45
const CTL_DAYS = 42
const ATL_DAYS = 7
const WINDOW_DAYS = 90

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
}

interface LoadSnapshot {
  ctl: number
  atl: number
  tsb: number
}

export function trimp(activity: Activity): number {
  if (!activity.avgHeartRate || !activity.durationSeconds) return 0
  const hrr = Math.min(
    1,
    Math.max(0, (activity.avgHeartRate - RESTING_HR) / (MAX_HR - RESTING_HR))
  )
  return (activity.durationSeconds / 60) * hrr * 0.64 * Math.exp(1.92 * hrr)
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Full TRIMP time series from first activity to today.
// TSB is the form at the START of each day (before that day's load).
function buildTimeSeries(activities: Activity[]): Map<string, LoadSnapshot> {
  const dailyLoad = new Map<string, number>()
  for (const a of activities) {
    dailyLoad.set(a.date, (dailyLoad.get(a.date) ?? 0) + trimp(a))
  }

  const series = new Map<string, LoadSnapshot>()
  const first = new Date(activities[activities.length - 1].date + 'T00:00:00')
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

export function getTrainingLoad(): TrainingLoadData | null {
  const activities = getAllActivities()
  if (!activities.length) return null

  const series = buildTimeSeries(activities)
  const entries = Array.from(series.entries())
  const window = entries.slice(-WINDOW_DAYS)

  const points: TrainingLoadPoint[] = window.map(([date, snap]) => {
    const d = new Date(date + 'T00:00:00')
    return {
      date,
      label: d.toLocaleDateString('en', { day: 'numeric', month: 'short' }),
      ...snap,
    }
  })

  const last = points[points.length - 1]
  return { points, ctl: last.ctl, atl: last.atl, tsb: last.tsb }
}
