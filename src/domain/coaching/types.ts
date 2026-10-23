import type { ActivityType } from '@/domain/activity/types'

export const COACHING_SCHEMA_VERSION = 1 as const

export type CoachDecisionOutcome = 'KEEP' | 'ADJUST' | 'REPLAN'
// autoregulation: a change proposed by code from the athlete's own runs, not by a model.
export type CoachTrigger = 'bootstrap' | 'post_activity' | 'weekly_review' | 'autoregulation'
export type CoachingPlanStatus = 'active' | 'completed' | 'superseded'
export type PrescriptionStatus = 'prescribed' | 'adjusted' | 'cancelled'

export type CoachingWorkoutType =
  | 'easy'
  | 'recovery'
  | 'long_run'
  | 'tempo'
  | 'threshold'
  | 'vo2max'
  | 'anaerobic'
  | 'sprint'
  | 'race'

export type WorkoutSegmentKind = 'warmup' | 'effort' | 'recovery' | 'cooldown' | 'strides'

export interface NumberRange {
  min: number
  max: number
}

export interface WorkoutTarget {
  durationSeconds?: number
  distanceMeters?: number
  paceSecPerKm?: NumberRange
  hrBpm?: NumberRange
  hrZone?: number
}

export interface WorkoutSegment {
  kind: WorkoutSegmentKind
  target: WorkoutTarget
  notes?: string[]
}

export interface WorkoutRepeatBlock {
  kind: 'repeat'
  repetitions: number
  steps: WorkoutSegment[]
}

export type WorkoutBlock = WorkoutSegment | WorkoutRepeatBlock

export interface CoachingProvenance {
  source: 'gemini' | 'manual' | 'demo' | 'autoregulation'
  trigger: CoachTrigger
  createdAt: string
  model?: string
  promptVersion?: string
  decisionId?: string
  parentRevision?: number
}

/**
 * What a workout's name states, as fields: "Threshold · 3 × 8′ @ 4:25" is
 * { reps: 3, repMinutes: 8, targetPace: '4:25' }, and the "6 strides" riding on
 * an easy run an extra. Nothing parses them back out of the name.
 */
export interface WorkoutNameStructure {
  reps?: number
  repMinutes?: number
  /** "4:25", per kilometre. */
  targetPace?: string
  extras?: string[]
}

export interface WorkoutPrescription {
  id: string
  revision: number
  date: string
  type: CoachingWorkoutType
  /** The workout's name: what the watch, Plan, Today and the run it becomes all show. */
  title: string
  /** The name for a tight row, at most 18 characters; rows without one fall back to the title. */
  shortName?: string
  structure?: WorkoutNameStructure
  description: string
  status: PrescriptionStatus
  totalDurationSeconds?: number
  totalDistanceMeters?: number
  blocks: WorkoutBlock[]
  notes?: string[]
  provenance: CoachingProvenance
}

export interface TrainingWeek {
  id: string
  index: number
  startDate: string
  endDate: string
  focus: string
  workouts: WorkoutPrescription[]
}

export interface TrainingBlock {
  id: string
  name: string
  startDate: string
  endDate: string
  focus: string
}

export type CoachingEventRole = 'primary' | 'tune_up'

export interface RaceCourseContext {
  pacingNotes: string[]
  paceProSplits?: { distanceMeters: number; targetSeconds: number }[]
}

export interface TargetEvent {
  courseContext?: RaceCourseContext
  id: string
  name: string
  date: string
  role?: CoachingEventRole
  distanceLabel?: string
  distanceMeters?: number
  location?: string
  targetSeconds?: number
}

export type TrainingGoal =
  | { kind: 'time'; targetSeconds: number; description: string }
  | { kind: 'finish'; description: string }
  | { kind: 'performance'; description: string }

export interface CoachingPlan {
  trainingPreferences?: { availableWeekdays: number[]; runsPerWeek?: number }
  schemaVersion: typeof COACHING_SCHEMA_VERSION
  id: string
  revision: number
  status: CoachingPlanStatus
  block: TrainingBlock
  macrocycleStartDate?: string
  /** Absent for general preparation: a block written to progress, not toward a race. */
  targetEvent?: TargetEvent
  tuneUpEvents?: TargetEvent[]
  goal: TrainingGoal
  weeks: TrainingWeek[]
  provenance: CoachingProvenance
}

export interface CoachEvidence {
  code: string
  message: string
  value?: number | string
  unit?: string
}

export type CoachPlanChange =
  | {
      kind: 'upsert_workout'
      before: WorkoutPrescription | null
      after: WorkoutPrescription
    }
  | {
      kind: 'cancel_workout'
      before: WorkoutPrescription
      after: WorkoutPrescription
    }
  | {
      kind: 'replace_future'
      effectiveDate: string
      beforeWeeks: TrainingWeek[]
      afterWeeks: TrainingWeek[]
    }

export interface CoachDecision {
  schemaVersion: typeof COACHING_SCHEMA_VERSION
  id: string
  outcome: CoachDecisionOutcome
  trigger: CoachTrigger
  createdAt: string
  effectiveDate: string
  planId: string
  basePlanRevision: number | null
  resultPlanRevision: number
  reasonCodes: string[]
  summary: string
  evidence: CoachEvidence[]
  changes: CoachPlanChange[]
  provenance: CoachingProvenance
}

export type PrescriptionMatchStatus = 'matched' | 'date_only' | 'unmatched'

export interface AggregateWorkoutComparison {
  plannedDistanceMeters?: number
  actualDistanceMeters?: number
  plannedDurationSeconds?: number
  actualDurationSeconds?: number
  plannedPaceSecPerKm?: NumberRange
  actualPaceSecPerKm?: number
  plannedHrBpm?: NumberRange
  actualAvgHrBpm?: number
}

export interface WorkoutEvaluation {
  schemaVersion: typeof COACHING_SCHEMA_VERSION
  id: string
  activityId: string
  activityDate: string
  prescriptionId: string | null
  planId: string
  planRevision: number
  matchStatus: PrescriptionMatchStatus
  comparison?: AggregateWorkoutComparison
  decisionId: string
  summary: string
  createdAt: string
  contextHash: string
  provenance: CoachingProvenance
}

export interface CoachState {
  schemaVersion: typeof COACHING_SCHEMA_VERSION
  activePlanId: string | null
  activePlanRevision: number | null
  lastDecisionId: string | null
  lastBootstrapAt: string | null
  lastPostActivityAt: string | null
  lastWeeklyReviewAt: string | null
  /** targetEventId is GENERAL_PREPARATION while no race is the target. */
  macrocycle?: { targetEventId: string; startDate: string }
  updatedAt: string
}

export type GarminScheduleStatus =
  | 'scheduled_match'
  | 'scheduled_different'
  | 'scheduled_unknown'
  | 'not_scheduled'

export const COACHING_TO_ACTIVITY_TYPE: Record<CoachingWorkoutType, ActivityType> = {
  easy: 'Base',
  recovery: 'Base',
  long_run: 'Base',
  tempo: 'Tempo',
  threshold: 'Threshold',
  vo2max: 'VO2Max',
  anaerobic: 'Anaerobic',
  sprint: 'Sprint',
  race: 'Race',
}
