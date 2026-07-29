import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { garminStatusType, type TrainingStatusType } from './GetTrainingStatus'

const DAYS = 28

export interface TrainingStatusDayBar {
  date: string
  status: TrainingStatusType | null
}

/** Garmin's own daily readings, oldest first, for the dashboard's day-by-day status bar. */
export function getTrainingStatusDaysBar(days: number = DAYS): TrainingStatusDayBar[] {
  return getTrainingStatusDays()
    .slice(-days)
    .map((day) => ({
      date: day.date,
      status: garminStatusType(day.status),
    }))
}
