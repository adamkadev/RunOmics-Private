import type { Activity } from '@/domain/activity/types'
import type {
  CoachDecisionOutcome,
  CoachEvidence,
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
  primaryTargetEvent: TargetEvent
  tuneUpEvents: TargetEvent[]
  horizonEndDate: string
  /** Where the season began, so the block can be told which phase it sits in. */
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

/**
 * Why a week sits below the volume floor. A field rather than a phrase in
 * `focus`, because the validator cannot take the generator's own prose as
 * evidence about the generator's own output.
 */
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

export interface CoachingAdvisor {
  bootstrap(request: BootstrapRequest): Promise<CoachingPlanDraft>
  evaluateActivity(input: {
    context: CoachingContext
    activity: Activity
    prescription: WorkoutPrescription | null
  }): Promise<AdvisorRecommendation>
  reviewWeek(input: { context: CoachingContext }): Promise<AdvisorRecommendation>
}
