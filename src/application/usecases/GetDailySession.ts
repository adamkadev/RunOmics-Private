import type { PlannedWorkout } from '@/domain/activity/types'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import { prescriptionAsPlannedWorkout } from '@/domain/coaching/plannedWorkout'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { addDays, isoDate } from '@/lib/calendarDate'
import { getPlannedWorkouts } from './GetPlannedWorkouts'

/** Either side of today: outside it there is no plan to report on each morning. */
export const PLAN_HORIZON_DAYS = 7

export interface DailySession {
  workout: PlannedWorkout | null
  source: 'garmin' | 'coach' | null
}

/**
 * Garmin's calendar first - it is what the watch will offer this morning - and
 * the coach's plan only where the calendar has nothing. Null when nothing at
 * all is planned within a week either way.
 */
export async function getDailySession(
  today: string,
  repository: Pick<CoachingRepository, 'getCurrentPlan'> = new JsonCoachingRepository(),
): Promise<DailySession | null> {
  const shift = (days: number) => isoDate(addDays(new Date(`${today}T00:00:00`), days))
  const from = shift(-PLAN_HORIZON_DAYS)
  const to = shift(PLAN_HORIZON_DAYS)

  const calendar = await getPlannedWorkouts()
  const prescriptions = (repository.getCurrentPlan()?.weeks ?? [])
    .flatMap((week) => week.workouts)
    .filter((workout) => workout.status !== 'cancelled')

  const nearby = (dates: readonly { date: string }[]) => dates.some((entry) => entry.date >= from && entry.date <= to)
  if (!nearby(calendar) && !nearby(prescriptions)) return null

  const onCalendar = calendar.find((workout) => workout.date === today)
  if (onCalendar) return { workout: onCalendar, source: 'garmin' }

  const prescribed = prescriptions.find((workout) => workout.date === today)
  return prescribed
    ? { workout: prescriptionAsPlannedWorkout(prescribed), source: 'coach' }
    : { workout: null, source: null }
}
