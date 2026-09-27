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
  /**
   * Keep a plan that is about to be replaced. Optional so in-memory doubles
   * need not implement it; a store that cannot archive simply drops it, which
   * is what replacing meant before this existed.
   */
  archivePlan?(plan: CoachingPlan): void
  /** The archived plans, newest first; optional for the same reason. */
  getArchivedPlans?(): CoachingPlan[]
}
