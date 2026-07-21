import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { garminStatusType, type TrainingStatusType } from './GetTrainingStatus'

/** Garmin's daily status keyed by ISO date, for views that browse arbitrary weeks client-side. */
export type TrainingStatusCalendar = Record<string, TrainingStatusType>

export function getTrainingStatusCalendar(): TrainingStatusCalendar {
  const calendar: TrainingStatusCalendar = {}

  for (const day of getTrainingStatusDays()) {
    // Days the watch declined to rate (`no_status`) are left out entirely, so a
    // week is judged on readings only.
    const status = garminStatusType(day.status)
    if (status) calendar[day.date] = status
  }

  return calendar
}
