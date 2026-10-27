import type { Activity } from '@/domain/activity/types'
import type {
  CoachDecisionOutcome,
  CoachEvidence,
  CoachingProvenance,
  CoachingWorkoutType,
  TargetEvent,
  TrainingWeek,
  WorkoutBlock,
  WorkoutNameStructure,
  WorkoutPrescription,
} from '@/domain/coaching/types'
import type { CoachingContext } from '@/application/coaching/context'

export interface BootstrapRequest {
  guidance?: string
  context: CoachingContext
  runsPerWeek?: number
  availableWeekdays: number[]
  planningStartDate: string
  /** Null for general preparation: no race is the target. */
  primaryTargetEvent: TargetEvent | null
  tuneUpEvents: TargetEvent[]
  horizonEndDate: string
  macrocycleStartDate: string
  targetEventId?: string
}

export interface BootstrapWorkoutDraft {
  date: string
  type: CoachingWorkoutType
  title: string
  shortName?: string
  structure?: WorkoutNameStructure
  description: string
  blocks: WorkoutBlock[]
  notes?: string[]
}

/** A field, not a phrase in `focus`: the validator cannot take the generator's own prose as evidence about its output. */
export const WEEK_REDUCTION_REASONS = ['cutback', 'deload', 'taper', 'recovery', 'illness', 'injury'] as const
export type WeekReductionReason = (typeof WEEK_REDUCTION_REASONS)[number]

export interface WeekVolumeReduction {
  reason: WeekReductionReason
  explanation: string
}

export interface BootstrapWeekDraft {
  startDate: string
  endDate: string
  focus: string
  reducedVolume?: WeekVolumeReduction
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

export interface WeeklyReviewRequest {
  context: CoachingContext
  /** The first day a change may touch; earlier sessions are fixed. */
  effectiveDate: string
  guidance?: string
}

export interface ActivityEvaluationRequest extends WeeklyReviewRequest {
  activity: Activity
  prescription: WorkoutPrescription | null
}

export interface CoachingAdvisor {
  /** Recorded as the advice's provenance; Gemini when unsaid. */
  readonly source?: CoachingProvenance['source']
  bootstrap(request: BootstrapRequest): Promise<CoachingPlanDraft>
  evaluateActivity(input: ActivityEvaluationRequest): Promise<AdvisorRecommendation>
  reviewWeek(input: WeeklyReviewRequest): Promise<AdvisorRecommendation>
}
