import type {
  CoachingPlan,
  NumberRange,
  TargetEvent,
  WorkoutBlock,
  WorkoutPrescription,
  WorkoutSegment,
  WorkoutSegmentKind,
  WorkoutTarget,
} from '@/domain/coaching/types'
import { hasCoursePacing } from '@/domain/coaching/coursePacing'

/**
 * Deterministic translation of a coach prescription into the JSON that Garmin's
 * private workout-service accepts (POST /workout-service/workout).
 *
 * Every field is derived from the prescription itself. A segment with no pace
 * and no heart-rate target maps to Garmin's explicit `no.target`, never to an
 * invented range - the same rule the plain-text export follows.
 */

interface GarminTypeRef {
  readonly displayOrder: number
}

export interface GarminSportType extends GarminTypeRef {
  sportTypeId: number
  sportTypeKey: string
}

export interface GarminStepType extends GarminTypeRef {
  stepTypeId: number
  stepTypeKey: string
}

export interface GarminEndCondition extends GarminTypeRef {
  conditionTypeId: number
  conditionTypeKey: string
  displayable: boolean
}

export interface GarminTargetType extends GarminTypeRef {
  workoutTargetTypeId: number
  workoutTargetTypeKey: string
}

export interface GarminExecutableStep {
  type: 'ExecutableStepDTO'
  stepId: number
  stepOrder: number
  stepType: GarminStepType
  description: string
  stepAudioNote: null
  endCondition: GarminEndCondition
  endConditionValue: number | null
  targetType: GarminTargetType
  targetValueOne?: number
  targetValueTwo?: number
  targetValueUnit?: null
  zoneNumber?: number
}

export interface GarminRepeatStep {
  type: 'RepeatGroupDTO'
  stepId: number
  stepOrder: number
  stepType: GarminStepType
  numberOfIterations: number
  smartRepeat: false
  endCondition: GarminEndCondition
  endConditionValue: number
  workoutSteps: GarminExecutableStep[]
}

export type GarminWorkoutStep = GarminExecutableStep | GarminRepeatStep

export interface GarminWorkoutPayload {
  workoutName: string
  description: string | null
  sportType: GarminSportType
  subSportType: null
  estimatedDurationInSecs: number | null
  estimatedDistanceInMeters: number | null
  estimatedDistanceUnit: { unitKey: null }
  avgTrainingSpeed: null
  estimateType: null
  workoutSegments: {
    segmentOrder: number
    sportType: GarminSportType
    workoutSteps: GarminWorkoutStep[]
  }[]
}

const RUNNING: GarminSportType = { sportTypeId: 1, sportTypeKey: 'running', displayOrder: 1 }

const STEP_TYPES = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup', displayOrder: 1 },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown', displayOrder: 2 },
  interval: { stepTypeId: 3, stepTypeKey: 'interval', displayOrder: 3 },
  recovery: { stepTypeId: 4, stepTypeKey: 'recovery', displayOrder: 4 },
  repeat: { stepTypeId: 6, stepTypeKey: 'repeat', displayOrder: 6 },
} as const satisfies Record<string, GarminStepType>

/**
 * Garmin has no dedicated strides step, so strides ride on `interval` - their
 * repetition count, duration and form cues all survive, which the plain
 * `other` bucket would lose.
 */
const STEP_TYPE_BY_KIND: Record<WorkoutSegmentKind, GarminStepType> = {
  warmup: STEP_TYPES.warmup,
  cooldown: STEP_TYPES.cooldown,
  effort: STEP_TYPES.interval,
  recovery: STEP_TYPES.recovery,
  strides: STEP_TYPES.interval,
}

const END_CONDITIONS = {
  lapButton: { conditionTypeId: 1, conditionTypeKey: 'lap.button', displayOrder: 1, displayable: true },
  time: { conditionTypeId: 2, conditionTypeKey: 'time', displayOrder: 2, displayable: true },
  distance: { conditionTypeId: 3, conditionTypeKey: 'distance', displayOrder: 3, displayable: true },
  iterations: { conditionTypeId: 7, conditionTypeKey: 'iterations', displayOrder: 7, displayable: false },
} as const satisfies Record<string, GarminEndCondition>

const TARGET_TYPES = {
  none: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target', displayOrder: 1 },
  heartRate: { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone', displayOrder: 4 },
  pace: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone', displayOrder: 6 },
} as const satisfies Record<string, GarminTargetType>

/**
 * Garmin stores a pace target as speed in metres per second, so the conversion
 * inverts: the *faster* bound of a `paceSecPerKm` range (the smaller number of
 * seconds) becomes the *higher* speed. Garmin orders the pair low-to-high, so
 * the slower pace lands in `targetValueOne` and the faster one in
 * `targetValueTwo` - the same layout the Garmin-sourced step fixtures in
 * scripts/tests/garmin_step_fixtures.py record.
 */
export function paceRangeToSpeedRange(pace: NumberRange): { targetValueOne: number; targetValueTwo: number } {
  if (pace.min <= 0 || pace.max <= 0) throw new Error('Pace bounds must be positive seconds per kilometre')
  const slower = Math.max(pace.min, pace.max)
  const faster = Math.min(pace.min, pace.max)
  return { targetValueOne: metresPerSecond(slower), targetValueTwo: metresPerSecond(faster) }
}

/** Six decimals: enough to round-trip a one-second-per-km pace difference. */
function metresPerSecond(secPerKm: number): number {
  return Math.round((1_000 / secPerKm) * 1e6) / 1e6
}

/**
 * One target per Garmin step. A prescription carrying both pace and heart rate
 * keeps pace as the executed target - it is the one the session is written
 * around - and the heart-rate bound is preserved in the step description rather
 * than dropped.
 */
function applyTarget(step: GarminExecutableStep, target: WorkoutTarget): void {
  if (target.paceSecPerKm) {
    const { targetValueOne, targetValueTwo } = paceRangeToSpeedRange(target.paceSecPerKm)
    step.targetType = TARGET_TYPES.pace
    step.targetValueOne = targetValueOne
    step.targetValueTwo = targetValueTwo
    step.targetValueUnit = null
    return
  }
  if (target.hrBpm) {
    step.targetType = TARGET_TYPES.heartRate
    step.targetValueOne = Math.min(target.hrBpm.min, target.hrBpm.max)
    step.targetValueTwo = Math.max(target.hrBpm.min, target.hrBpm.max)
    step.targetValueUnit = null
    return
  }
  if (target.hrZone !== undefined) {
    step.targetType = TARGET_TYPES.heartRate
    step.zoneNumber = target.hrZone
    return
  }
  step.targetType = TARGET_TYPES.none
}

/** Distance leads when a segment prescribes both, matching the plain-text export. */
function applyEndCondition(step: GarminExecutableStep, target: WorkoutTarget): void {
  if (target.distanceMeters !== undefined) {
    step.endCondition = END_CONDITIONS.distance
    step.endConditionValue = target.distanceMeters
    return
  }
  if (target.durationSeconds !== undefined) {
    step.endCondition = END_CONDITIONS.time
    step.endConditionValue = target.durationSeconds
    return
  }
  step.endCondition = END_CONDITIONS.lapButton
  step.endConditionValue = null
}

function stepDescription(segment: WorkoutSegment): string {
  const notes = [...(segment.notes ?? [])]
  // Only surfaced when heart rate lost the target slot to pace above.
  if (segment.target.paceSecPerKm && segment.target.hrBpm) {
    notes.push(`HR ${segment.target.hrBpm.min}-${segment.target.hrBpm.max} bpm`)
  }
  if (segment.target.paceSecPerKm && segment.target.hrZone !== undefined) {
    notes.push(`HR zone ${segment.target.hrZone}`)
  }
  return notes.join(' ')
}

function executableStep(segment: WorkoutSegment, stepOrder: number): GarminExecutableStep {
  const step: GarminExecutableStep = {
    type: 'ExecutableStepDTO',
    stepId: stepOrder,
    stepOrder,
    stepType: STEP_TYPE_BY_KIND[segment.kind],
    description: stepDescription(segment),
    stepAudioNote: null,
    endCondition: END_CONDITIONS.lapButton,
    endConditionValue: null,
    targetType: TARGET_TYPES.none,
  }
  applyEndCondition(step, segment.target)
  applyTarget(step, segment.target)
  return step
}

function blockSteps(block: WorkoutBlock, nextOrder: number): { steps: GarminWorkoutStep[]; nextOrder: number } {
  if (block.kind !== 'repeat') return { steps: [executableStep(block, nextOrder)], nextOrder: nextOrder + 1 }

  const group: GarminRepeatStep = {
    type: 'RepeatGroupDTO',
    stepId: nextOrder,
    stepOrder: nextOrder,
    stepType: STEP_TYPES.repeat,
    numberOfIterations: block.repetitions,
    smartRepeat: false,
    endCondition: END_CONDITIONS.iterations,
    endConditionValue: block.repetitions,
    workoutSteps: [],
  }
  let order = nextOrder + 1
  for (const child of block.steps) {
    group.workoutSteps.push(executableStep(child, order))
    order += 1
  }
  return { steps: [group], nextOrder: order }
}

function workoutDescription(workout: WorkoutPrescription): string | null {
  const lines = [workout.description, ...(workout.notes ?? [])].filter(Boolean)
  return lines.length ? [...new Set(lines)].join('\n') : null
}

/**
 * Garmin's own estimates are only ever the prescription's own totals. Nothing
 * is reconstructed from step pace midpoints here: an absent total stays absent
 * and Garmin computes its own.
 */
export function toGarminWorkoutPayload(workout: WorkoutPrescription): GarminWorkoutPayload {
  const steps: GarminWorkoutStep[] = []
  let order = 1
  for (const block of workout.blocks) {
    const mapped = blockSteps(block, order)
    steps.push(...mapped.steps)
    order = mapped.nextOrder
  }

  return {
    workoutName: workout.title,
    description: workoutDescription(workout),
    sportType: RUNNING,
    subSportType: null,
    estimatedDurationInSecs: workout.totalDurationSeconds ?? null,
    estimatedDistanceInMeters: workout.totalDistanceMeters ?? null,
    estimatedDistanceUnit: { unitKey: null },
    avgTrainingSpeed: null,
    estimateType: null,
    workoutSegments: [{ segmentOrder: 1, sportType: RUNNING, workoutSteps: steps }],
  }
}

/** The plan event raced on this prescription's date, if the prescription is a race. */
export function raceEventFor(plan: CoachingPlan, workout: WorkoutPrescription): TargetEvent | null {
  if (workout.type !== 'race') return null
  return [plan.targetEvent, ...(plan.tuneUpEvents ?? [])].find((event) => event.date === workout.date) ?? null
}

/** A race whose event carries the athlete's own course/PacePro strategy. */
export function isCourseAwareRace(plan: CoachingPlan, workout: WorkoutPrescription): boolean {
  const event = raceEventFor(plan, workout)
  return event !== null && hasCoursePacing(event)
}

/**
 * A course-aware race is paced on the watch by the athlete's own PacePro
 * strategy, so its race effort must reach Garmin with no pace target: a
 * structured range over the same kilometres would compete with PacePro instead
 * of supporting it. Only the full-distance effort is stripped - warmup and
 * cooldown keep their easy ranges, which PacePro does not cover.
 *
 * The coach normally strips that target already (see `withCourseAwareRacePacing`);
 * this is the guarantee at the Garmin boundary, so no future plan revision can
 * push a constant race pace onto a PacePro course by accident.
 */
export function withoutCourseAwarePaceTarget(
  workout: WorkoutPrescription,
  event: TargetEvent,
): { workout: WorkoutPrescription; stripped: boolean } {
  let stripped = false
  const blocks = workout.blocks.map((block) => {
    if (block.kind === 'repeat' || block.kind !== 'effort') return block
    if (block.target.distanceMeters !== event.distanceMeters || !block.target.paceSecPerKm) return block
    stripped = true
    const target = { ...block.target }
    delete target.paceSecPerKm
    return { ...block, target }
  })
  return { workout: stripped ? { ...workout, blocks } : workout, stripped }
}
