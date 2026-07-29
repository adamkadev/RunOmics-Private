import { getTrainingStatusWeekSamples } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { addDays, isoDate } from '@/lib/calendarDate'
import { garminStatusType, type TrainingStatusType } from './GetTrainingStatus'

const WEEKS = 4

export interface TrainingStatusWeek {
  weekStart: string
  weekEnd: string
  status: TrainingStatusType | null
}

/**
 * Garmin's own weekly readings, oldest first. Each sample is dated on the day
 * Garmin closed the week, so the window is the six days leading up to it - the
 * running week's sample is dated today and is therefore shorter.
 */
export function getTrainingStatusWeeks(weeks: number = WEEKS): TrainingStatusWeek[] {
  return getTrainingStatusWeekSamples()
    .slice(-weeks)
    .map((sample) => ({
      weekStart: isoDate(addDays(new Date(sample.date + 'T00:00:00'), -6)),
      weekEnd: sample.date,
      status: garminStatusType(sample.status),
    }))
}
