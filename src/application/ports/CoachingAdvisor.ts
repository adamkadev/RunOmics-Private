import type { Activity } from '@/domain/activity/types'
import type {
  CoachDecisionOutcome,
  CoachEvidence,
  CoachingWorkoutType,
  TargetEvent,
  TrainingWeek,
  WorkoutBlock,
  WorkoutPrescription,
} from '@/domain/coaching/types'
import type { CoachingContext } from '@/application/coaching/context'

export interface BootstrapRequest {
  context: CoachingContext
  availableWeekdays: number[]
  primaryTargetEvent: TargetEvent
  tuneUpEvents: TargetEvent[]
  horizonEndDate: string
  targetEventId?: string
}


export interface BootstrapWorkoutDraft {
  date: string
  type: CoachingWorkoutType
  title: string
  description: string
  blocks: WorkoutBlock[]
  notes?: string[]
}

export interface BootstrapWeekDraft {
  startDate: string
  endDate: string
  focus: string
  workouts: BootstrapWorkoutDraft[]
}

export interface CoachingPlanDraft {
  name: string
  focus: string
  weeks: BootstrapWeekDraft[]
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
  bootstrap(request: BootstrapRequest): Promise<CoachingPlanDraft>
  evaluateActivity(input: {
    context: CoachingContext
    activity: Activity
    prescription: WorkoutPrescription | null
  }): Promise<AdvisorRecommendation>
  reviewWeek(input: { context: CoachingContext }): Promise<AdvisorRecommendation>
}
