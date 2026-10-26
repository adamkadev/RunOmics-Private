import type { Activity } from '@/domain/activity/types'
import { withEffectiveTypes } from '@/domain/activity/effectiveType'
import { sessionForRun, sessionsAcrossPlans, type RunSession } from '@/domain/coaching/sessionForRun'
import type { CoachingPlan, WorkoutEvaluation, WorkoutPrescription } from '@/domain/coaching/types'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import { appTodayIso } from '@/lib/calendarDate'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'

export type PrescriptionDisplayState = 'prescribed' | 'adjusted' | 'completed' | 'missed' | 'cancelled'

export interface PrescriptionView {
  prescription: WorkoutPrescription
  state: PrescriptionDisplayState
  activityId: string | null
}

export interface CoachingOverview {
  plan: CoachingPlan
  currentWeekId: string | null
  workouts: PrescriptionView[]
}

function completedRuns(plan: CoachingPlan, evaluations: WorkoutEvaluation[], activities: Activity[]): Map<string, Activity> {
  const sessions = sessionsAcrossPlans([plan], evaluations)
  const runs = new Map<string, Activity>()
  for (const activity of activities) {
    const session = sessionForRun(activity, sessions)
    if (session && !runs.has(session.id)) runs.set(session.id, activity)
  }
  return runs
}

export function buildCoachingOverview(
  plan: CoachingPlan,
  evaluations: WorkoutEvaluation[],
  activities: Activity[],
  today: string,
): CoachingOverview {
  const runs = completedRuns(plan, evaluations, activities)
  const views = plan.weeks.flatMap((week) => week.workouts).map((prescription): PrescriptionView => {
    const activity = runs.get(prescription.id) ?? null
    const state: PrescriptionDisplayState = prescription.status === 'cancelled'
      ? 'cancelled'
      : activity
        ? 'completed'
        : prescription.date < today
          ? 'missed'
          : prescription.status === 'adjusted'
            ? 'adjusted'
            : 'prescribed'
    return { prescription, state, activityId: activity?.id ?? null }
  }).sort((a, b) => a.prescription.date.localeCompare(b.prescription.date))

  const currentWeek = plan.weeks.find((week) => today >= week.startDate && today <= week.endDate) ?? null
  return { plan, currentWeekId: currentWeek?.id ?? null, workouts: views }
}

// Both readers must date "today" by appTodayIso(), as their pages do, or they disagree on the day after local midnight.
export function getCoachingOverview(
  today = appTodayIso(),
  repository: Pick<CoachingRepository, 'getCurrentPlan' | 'getEvaluations'> = new JsonCoachingRepository(),
): CoachingOverview | null {
  const plan = repository.getCurrentPlan()
  if (!plan) return null
  return buildCoachingOverview(plan, repository.getEvaluations(), getAllActivities(), today)
}

/** An archive that fails to parse costs only the superseded blocks, never the page. */
export function archivedPlans(repository: Pick<CoachingRepository, 'getArchivedPlans'> = new JsonCoachingRepository()): CoachingPlan[] {
  try {
    return repository.getArchivedPlans?.() ?? []
  } catch (error) {
    console.error('[coaching] archived plans unreadable', error)
    return []
  }
}

export function getRunSessions(
  repository: Pick<CoachingRepository, 'getCurrentPlan' | 'getEvaluations' | 'getArchivedPlans'> = new JsonCoachingRepository(),
): RunSession[] {
  const current = repository.getCurrentPlan()
  return sessionsAcrossPlans([...(current ? [current] : []), ...archivedPlans(repository)], repository.getEvaluations())
}

/** Every run as Analytics and Shoes count it; an unreadable plan costs the coach's types, never the page. */
export function getActivitiesWithEffectiveTypes(): Activity[] {
  const activities = getAllActivities()
  try {
    return withEffectiveTypes(activities, getRunSessions())
  } catch (error) {
    console.error('[coaching] plan unreadable, runs keep their own types', error)
    return activities
  }
}

/** Reads the plan alone: the overview walks every week against every evaluation, too much for one row. */
export function getTodayPrescription(
  today = appTodayIso(),
  repository: Pick<CoachingRepository, 'getCurrentPlan'> = new JsonCoachingRepository(),
): WorkoutPrescription | null {
  const plan = repository.getCurrentPlan()
  if (!plan) return null

  return (
    plan.weeks
      .flatMap((week) => week.workouts)
      .find((workout) => workout.date === today && workout.status !== 'cancelled') ?? null
  )
}
