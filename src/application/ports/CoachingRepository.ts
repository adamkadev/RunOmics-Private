import type {
  CoachDecision,
  CoachState,
  CoachingPlan,
  WorkoutEvaluation,
} from '@/domain/coaching/types'

export interface CoachingRepository {
  getCurrentPlan(): CoachingPlan | null
  saveCurrentPlan(plan: CoachingPlan): void
  getState(): CoachState | null
  saveState(state: CoachState): void
  getDecisions(): CoachDecision[]
  getDecision(id: string): CoachDecision | null
  saveDecision(decision: CoachDecision): void
  getEvaluations(): WorkoutEvaluation[]
  getEvaluationForActivity(activityId: string): WorkoutEvaluation | null
  saveEvaluation(evaluation: WorkoutEvaluation): void
  /** Optional so in-memory doubles need not implement it; a store that cannot archive drops the plan. */
  archivePlan?(plan: CoachingPlan): void
  /** Newest first. */
  getArchivedPlans?(): CoachingPlan[]
}
