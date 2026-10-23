import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { trainingStatusDays } from '@/domain/training/statusHistory'
import { appTodayIso } from '@/lib/calendarDate'
import { garminStatusType, type TrainingStatusType } from './GetTrainingStatus'

const DAYS = 28

export interface TrainingStatusDayBar {
  date: string
  status: TrainingStatusType | null
}

export function getTrainingStatusDaysBar(days: number = DAYS, todayIso: string = appTodayIso()): TrainingStatusDayBar[] {
  const rated = getTrainingStatusDays().map((day) => ({ date: day.date, status: garminStatusType(day.status) }))
  const window = trainingStatusDays(rated, todayIso, days)
  return window.some((d) => d.status) ? window : []
}
