import type { Activity } from '@/domain/activity/types'
import type {
  CoachDecisionOutcome,
  CoachEvidence,
  CoachingPlan,
  TrainingWeek,
  WorkoutPrescription,
} from '@/domain/coaching/types'
import type { CoachingContext } from '@/application/coaching/context'

export interface BootstrapRequest {
  context: CoachingContext
  availableWeekdays: number[]
  targetEventId?: string
}

export type AdvisorPlanChange =
  | { kind: 'upsert_workout'; workoutId?: string; workout: WorkoutPrescription }
  | { kind: 'cancel_workout'; workoutId: string }
  | { kind: 'replace_future'; effectiveDate: string; weeks: TrainingWeek[] }

export interface AdvisorRecommendation {
  outcome: CoachDecisionOutcome
  reasonCodes: string[]
  summary: string
  evidence: CoachEvidence[]
  changes: AdvisorPlanChange[]
}

export interface CoachingAdvisor {
  bootstrap(request: BootstrapRequest): Promise<CoachingPlan>
  evaluateActivity(input: {
    context: CoachingContext
    activity: Activity
    prescription: WorkoutPrescription | null
  }): Promise<AdvisorRecommendation>
  reviewWeek(input: { context: CoachingContext }): Promise<AdvisorRecommendation>
}
