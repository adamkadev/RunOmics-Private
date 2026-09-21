import type { Activity } from '@/domain/activity/types'
import type {
  CoachDecision,
  CoachingPlan,
  GarminScheduleStatus,
  WorkoutEvaluation,
  WorkoutPrescription,
} from '@/domain/coaching/types'
import { garminScheduleStatus } from '@/domain/coaching/matching'
import { isoDate } from '@/lib/calendarDate'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'

export type PrescriptionDisplayState = 'prescribed' | 'adjusted' | 'completed' | 'missed' | 'cancelled'

export interface PrescriptionView {
  prescription: WorkoutPrescription
  state: PrescriptionDisplayState
  garminStatus: GarminScheduleStatus
  activityId: string | null
}

export interface CoachingOverview {
  plan: CoachingPlan
  currentWeekId: string | null
  workouts: PrescriptionView[]
  latestDecision: CoachDecision | null
  latestEvaluation: WorkoutEvaluation | null
  nextKeyWorkout: PrescriptionView | null
}

export interface ActivityCoachingView {
  evaluation: WorkoutEvaluation
  decision: CoachDecision | null
  prescription: WorkoutPrescription | null
}

function findCompletedActivity(prescription: WorkoutPrescription, evaluations: WorkoutEvaluation[], activities: Activity[]): Activity | null {
  const evaluation = evaluations.find((candidate) => candidate.prescriptionId === prescription.id && candidate.matchStatus === 'matched')
  if (evaluation) return activities.find((activity) => activity.id === evaluation.activityId) ?? null
  return null
}

export function buildCoachingOverview(
  plan: CoachingPlan,
  decisions: CoachDecision[],
  evaluations: WorkoutEvaluation[],
  activities: Activity[],
  plannedWorkouts: ReturnType<typeof getAllPlannedWorkouts>,
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
    return {
      prescription,
      state,
      garminStatus: garminScheduleStatus(prescription, plannedWorkouts.find((planned) => planned.date === prescription.date) ?? null),
      activityId: activity?.id ?? null,
    }
  }).sort((a, b) => a.prescription.date.localeCompare(b.prescription.date))

  const currentWeek = plan.weeks.find((week) => today >= week.startDate && today <= week.endDate) ?? null
  const latestDecision = decisions[0] ?? null
  const latestEvaluation = evaluations[0] ?? null
  const nextKeyWorkout = views.find((view) =>
    view.prescription.date >= today &&
    view.prescription.status !== 'cancelled' &&
    !['easy', 'recovery'].includes(view.prescription.type)
  ) ?? null

  return { plan, currentWeekId: currentWeek?.id ?? null, workouts: views, latestDecision, latestEvaluation, nextKeyWorkout }
}

export function getCoachingOverview(today = new Date().toISOString().slice(0, 10)): CoachingOverview | null {
  const repository = new JsonCoachingRepository()
  const plan = repository.getCurrentPlan()
  if (!plan) return null
  return buildCoachingOverview(
    plan,
    repository.getDecisions(),
    repository.getEvaluations(),
    getAllActivities(),
    getAllPlannedWorkouts(),
    today,
  )
}

/**
 * Today's live prescription, read straight off the plan.
 *
 * The overview above answers a screen's worth of questions - display state,
 * Garmin scheduling, the matched activity - by walking every week against every
 * evaluation. A caller that only wants to know what today asks for pays all of
 * that for one row, so this reads the plan and nothing else.
 */
export function getTodayPrescription(today = isoDate(new Date())): WorkoutPrescription | null {
  const plan = new JsonCoachingRepository().getCurrentPlan()
  if (!plan) return null

  return (
    plan.weeks
      .flatMap((week) => week.workouts)
      .find((workout) => workout.date === today && workout.status !== 'cancelled') ?? null
  )
}

export function getActivityCoachingView(activityId: string): ActivityCoachingView | null {
  const repository = new JsonCoachingRepository()
  const evaluation = repository.getEvaluationForActivity(activityId)
  if (!evaluation) return null
  const plan = repository.getCurrentPlan()
  const prescription = plan?.weeks.flatMap((week) => week.workouts).find((workout) => workout.id === evaluation.prescriptionId) ?? null
  return { evaluation, decision: repository.getDecision(evaluation.decisionId), prescription }
}
