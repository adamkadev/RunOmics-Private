import { t } from '@/i18n'
import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { garminStatusType, type TrainingStatusType } from './GetTrainingStatus'

const WINDOW_DAYS = 90

export interface TrainingStatusHistoryPoint {
  date: string
  label: string
  status: TrainingStatusType | null
  acuteLoad: number | null
  chronicLoad: number | null
  /** Garmin's personalised optimal band for chronic load, as [min, height] so Recharts can stack it. */
  targetBand: [number, number] | null
}

/** One uninterrupted run of the same status, for the ribbon under the chart. */
export interface TrainingStatusSegment {
  status: TrainingStatusType
  days: number
  from: string
  to: string
}

export interface TrainingStatusHistory {
  points: TrainingStatusHistoryPoint[]
  segments: TrainingStatusSegment[]
  /** Days covered by the window that carry a status - the rest are unworn days. */
  ratedDays: number
}

/**
 * Collapse consecutive days sharing a status into segments. Days the watch
 * declined to rate (`no_status`, or nothing at all) break a run rather than
 * extending it, so the ribbon never implies continuity the data lacks.
 */
export function buildSegments(points: TrainingStatusHistoryPoint[]): TrainingStatusSegment[] {
  const segments: TrainingStatusSegment[] = []

  for (const point of points) {
    const status = point.status
    if (!status) continue

    const last = segments[segments.length - 1]
    if (last && last.status === status && isNextDay(last.to, point.date)) {
      last.days += 1
      last.to = point.date
      continue
    }
    segments.push({ status, days: 1, from: point.date, to: point.date })
  }

  return segments
}

function isNextDay(previous: string, current: string): boolean {
  const gap = new Date(current + 'T00:00:00').getTime() - new Date(previous + 'T00:00:00').getTime()
  return gap === 86_400_000
}

export function getTrainingStatusHistory(): TrainingStatusHistory | null {
  const days = getTrainingStatusDays().slice(-WINDOW_DAYS)
  if (days.length < 14) return null

  const points: TrainingStatusHistoryPoint[] = days.map((day) => ({
    date: day.date,
    label: new Date(day.date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }),
    status: garminStatusType(day.status),
    acuteLoad: day.acuteLoad ?? null,
    chronicLoad: day.chronicLoad ?? null,
    targetBand:
      day.chronicLoadMin !== undefined && day.chronicLoadMax !== undefined
        ? [Math.round(day.chronicLoadMin), Math.round(day.chronicLoadMax - day.chronicLoadMin)]
        : null,
  }))

  const segments = buildSegments(points)
  if (!segments.length) return null

  return {
    points,
    segments,
    ratedDays: segments.reduce((sum, segment) => sum + segment.days, 0),
  }
}
