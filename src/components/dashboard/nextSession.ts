import type { PlannedWorkout } from '@/domain/activity/types'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { coachWorkoutView, plannedWorkoutView } from '@/components/plan/planWorkoutView'
import { workoutSummary } from '@/components/plan/workoutSummary'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatPlannedKm } from '@/lib/formatters'
import { kindOfType, type SessionKind } from './todayVerdict'

/** The next session on the plan after today, as the hero's rest row names it. */
export interface NextSession {
  date: string
  title: string
  /** Whole planned km ("10"), or null when the plan gives no distance. */
  km: string | null
  /** Days after today: 1 is tomorrow. */
  inDays: number
  /** The session's kind, the coach's own type over the plan's, for the verdict's words. */
  kind: SessionKind | null
}

/** A week ahead: past that, "next" is no longer what today's rest is for. */
const HORIZON_DAYS = 7

/**
 * The first day after today with a session on it, in Plan's priority - the
 * coach's prescription over Garmin's, a cancelled one is no session - and in
 * Plan's words (workoutSummary), so the two screens name it alike.
 */
export function findNextSession(
  today: string,
  coach: readonly Parameters<typeof coachWorkoutView>[0][],
  garmin: readonly PlannedWorkout[],
  zones: TrainingZonesData | null = null,
): NextSession | null {
  const start = new Date(`${today}T00:00:00`)
  for (let i = 1; i <= HORIZON_DAYS; i++) {
    const date = isoDate(addDays(start, i))
    const view = coach.find((v) => v.prescription.date === date && v.state !== 'cancelled')
    const plan = garmin.find((p) => p.date === date) ?? null
    const workout = view ? coachWorkoutView(view, zones, plan) : plan ? plannedWorkoutView(plan, zones) : null
    if (!workout) continue
    return {
      date,
      title: workoutSummary(workout).title,
      km: workout.distanceM ? formatPlannedKm(workout.distanceM / 1000) : null,
      inDays: i,
      kind: view ? view.prescription.type : plan?.type ? kindOfType(plan.type) : null,
    }
  }
  return null
}
