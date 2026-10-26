import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { buildSegments } from '@/domain/training/statusHistory'
import { buildingBack } from '@/domain/training/buildingBack'
import { LOAD_TREND_DAYS } from '@/domain/training/status'
import { DAY_MS } from '@/lib/calendarDate'
import { round } from '@/lib/math'
import { acwr, classify, garminStatusType, type TrainingStatusType } from './GetTrainingStatus'
import { athleteHrBounds, buildTimeSeries } from './GetTrainingLoad'

const MAX_DAYS = 1095

export interface TrainingStatusHistoryPoint {
  date: string
  status: TrainingStatusType | null
  acuteLoad: number | null
  chronicLoad: number | null
  targetBand: [number, number] | null
}

export interface TrainingStatusHistory {
  points: TrainingStatusHistoryPoint[]
  source: 'garmin' | 'local'
}

/** A day this long after the last run has no status, as the watch gives none once it is put away. */
const LOCAL_STATUS_DAYS = 28

export function getTrainingStatusHistory(): TrainingStatusHistory | null {
  const days = getTrainingStatusDays().slice(-MAX_DAYS)
  if (days.length < 14) return null

  const points: TrainingStatusHistoryPoint[] = days.map((day) => ({
    date: day.date,
    status: garminStatusType(day.status),
    acuteLoad: day.acuteLoad ?? null,
    chronicLoad: day.chronicLoad ?? null,
    targetBand:
      day.chronicLoadMin !== undefined && day.chronicLoadMax !== undefined
        ? [day.chronicLoadMin, day.chronicLoadMax - day.chronicLoadMin]
        : null,
  }))

  if (!buildSegments(points).length) return null

  return { points, source: 'garmin' }
}

/** For a watch that rates no status: Today's own reading, made again on each day from what was run by then. */
export function getLocalTrainingStatusHistory(): TrainingStatusHistory | null {
  const activities = getAllActivities()
  const series = [...buildTimeSeries(activities, athleteHrBounds())]
  const points: TrainingStatusHistoryPoint[] = series.slice(-MAX_DAYS).map(([date, day], at, window) => {
    const i = series.length - window.length + at
    const upTo = activities.filter((a) => a.date <= date)
    const latest = upTo[0]
    const ctlDelta = round(day.ctl - series[Math.max(0, i - LOAD_TREND_DAYS)]![1].ctl, 1)
    const status =
      !latest || Date.parse(date) - Date.parse(latest.date) >= LOCAL_STATUS_DAYS * DAY_MS || buildingBack(upTo.map((a) => a.date), date)
        ? null
        // The day being replayed, not its last run: anchored on the run, a week off reads as a full acute week.
        : classify(day.tsb, ctlDelta, acwr(upTo, new Date(`${date}T00:00:00`))).status
    return { date, status, acuteLoad: null, chronicLoad: null, targetBand: null }
  })
  if (points.length < 14 || !buildSegments(points).length) return null

  return { points, source: 'local' }
}
