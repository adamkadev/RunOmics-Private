import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { garminStatusType, type TrainingStatusType } from './GetTrainingStatus'

export type TrainingStatusCalendar = Record<string, TrainingStatusType>

export function getTrainingStatusCalendar(): TrainingStatusCalendar {
  const calendar: TrainingStatusCalendar = {}

  for (const day of getTrainingStatusDays()) {
    const status = garminStatusType(day.status)
    if (status) calendar[day.date] = status
  }

  return calendar
}
