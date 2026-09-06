import { t } from '@/i18n'
import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { buildSegments } from '@/domain/training/statusHistory'
import { garminStatusType, type TrainingStatusType } from './GetTrainingStatus'

const MAX_DAYS = 1095

export interface TrainingStatusHistoryPoint {
  date: string
  label: string
  status: TrainingStatusType | null
  acuteLoad: number | null
  chronicLoad: number | null
  targetBand: [number, number] | null
}

export interface TrainingStatusHistory {
  points: TrainingStatusHistoryPoint[]
}

export function getTrainingStatusHistory(): TrainingStatusHistory | null {
  const days = getTrainingStatusDays().slice(-MAX_DAYS)
  if (days.length < 14) return null

  const points: TrainingStatusHistoryPoint[] = days.map((day) => ({
    date: day.date,
    label: new Date(day.date + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }),
    status: garminStatusType(day.status),
    acuteLoad: day.acuteLoad ?? null,
    chronicLoad: day.chronicLoad ?? null,
    targetBand:
      day.chronicLoadMin !== undefined && day.chronicLoadMax !== undefined
        ? [day.chronicLoadMin, day.chronicLoadMax - day.chronicLoadMin]
        : null,
  }))

  if (!buildSegments(points).length) return null

  return { points }
}
