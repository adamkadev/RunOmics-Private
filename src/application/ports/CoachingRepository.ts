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
}
