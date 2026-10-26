import type { Activity } from '@/domain/activity/types'
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

function findCompletedActivity(prescription: WorkoutPrescription, evaluations: WorkoutEvaluation[], activities: Activity[]): Activity | null {
  const evaluation = evaluations.find((candidate) => candidate.prescriptionId === prescription.id && candidate.matchStatus === 'matched')
  if (evaluation) return activities.find((activity) => activity.id === evaluation.activityId) ?? null
  return null
}

export function buildCoachingOverview(
  plan: CoachingPlan,
  evaluations: WorkoutEvaluation[],
  activities: Activity[],
  today: string,
): CoachingOverview {
  const views = plan.weeks.flatMap((week) => week.workouts).map((prescription): PrescriptionView => {
    const activity = findCompletedActivity(prescription, evaluations, activities)
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

export interface RunSession {
  prescription: WorkoutPrescription
  activityId: string | null
}

/** `plans` newest first; an older plan's session counts only on a day no newer plan's weeks cover. */
export function sessionsAcrossPlans(plans: readonly CoachingPlan[], evaluations: WorkoutEvaluation[]): RunSession[] {
  const matched = new Map(evaluations
    .filter((evaluation) => evaluation.matchStatus === 'matched' && evaluation.prescriptionId !== null)
    .map((evaluation) => [evaluation.prescriptionId!, evaluation.activityId]))
  const covered: { startDate: string; endDate: string }[] = []
  const sessions: RunSession[] = []
  for (const plan of plans) {
    for (const prescription of plan.weeks.flatMap((week) => week.workouts)) {
      if (covered.some((week) => prescription.date >= week.startDate && prescription.date <= week.endDate)) continue
      sessions.push({ prescription, activityId: matched.get(prescription.id) ?? null })
    }
    covered.push(...plan.weeks)
  }
  return sessions
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
