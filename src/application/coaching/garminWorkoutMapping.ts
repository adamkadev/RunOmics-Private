import type {
  CoachingPlan,
  CoachingWorkoutType,
  NumberRange,
  TargetEvent,
  WorkoutBlock,
  WorkoutPrescription,
  WorkoutSegment,
  WorkoutSegmentKind,
  WorkoutTarget,
} from '@/domain/coaching/types'
import { hasCoursePacing } from '@/domain/coaching/coursePacing'
import { t } from '@/i18n'

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

export function paceRangeToSpeedRange(pace: NumberRange): { targetValueOne: number; targetValueTwo: number } {
  if (pace.min <= 0 || pace.max <= 0) throw new Error('Pace bounds must be positive seconds per kilometre')
  const slower = Math.max(pace.min, pace.max)
  const faster = Math.min(pace.min, pace.max)
  return { targetValueOne: metresPerSecond(slower), targetValueTwo: metresPerSecond(faster) }
}

function metresPerSecond(secPerKm: number): number {
  return Math.round((1_000 / secPerKm) * 1e6) / 1e6
}

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

const EASY_TYPES: ReadonlySet<CoachingWorkoutType> = new Set(['easy', 'recovery', 'long_run'])

const HEART_RATE_TEXT = /\b(?:heart[- ]rate|HR|FC|bpm|cardio)\b|fréquence cardiaque|\bz(?:one)?\s*(?:FC\s*)?[1-5]\b/i

const withoutHeartRateText = (lines: readonly string[]) => lines.filter((line) => !HEART_RATE_TEXT.test(line))

/** An HR-only step keeps its zone: it is the step's one target, as a return to running prescribes it. */
function easySegment(segment: WorkoutSegment): WorkoutSegment {
  const target = { ...segment.target }
  if (target.paceSecPerKm) {
    delete target.hrBpm
    delete target.hrZone
  }
  return { ...segment, target, ...(segment.notes ? { notes: withoutHeartRateText(segment.notes) } : {}) }
}

/** Each HR line is one more screen to scroll on the watch, for a run the pace already guides. */
export function withoutEasyHeartRate(workout: WorkoutPrescription): WorkoutPrescription {
  if (!EASY_TYPES.has(workout.type)) return workout
  return {
    ...workout,
    description: withoutHeartRateText([workout.description])[0] ?? '',
    ...(workout.notes ? { notes: withoutHeartRateText(workout.notes) } : {}),
    blocks: workout.blocks.map((block) => block.kind === 'repeat' ? { ...block, steps: block.steps.map(easySegment) } : easySegment(block)),
  }
}

function stepDescription(segment: WorkoutSegment): string {
  const notes = [...(segment.notes ?? [])]
  if (segment.target.paceSecPerKm && segment.target.hrBpm) {
    notes.push(t.coaching.garminStep.hr(segment.target.hrBpm.min, segment.target.hrBpm.max))
  }
  if (segment.target.paceSecPerKm && segment.target.hrZone !== undefined) {
    notes.push(t.coaching.garminStep.hrZone(segment.target.hrZone))
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
 * Watch fonts carry Latin-1 (×, ·, accents) but not primes, so those go as the apostrophe and quote.
 * A name without primes is unchanged, and so is its content hash: nothing already pushed moves.
 */
export function garminWorkoutName(title: string): string {
  return title.replaceAll('′', "'").replaceAll('″', '"')
}

export function toGarminWorkoutPayload(prescription: WorkoutPrescription): GarminWorkoutPayload {
  const workout = withoutEasyHeartRate(prescription)
  const steps: GarminWorkoutStep[] = []
  let order = 1
  for (const block of workout.blocks) {
    const mapped = blockSteps(block, order)
    steps.push(...mapped.steps)
    order = mapped.nextOrder
  }

  return {
    workoutName: garminWorkoutName(workout.title),
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

export function raceEventFor(plan: CoachingPlan, workout: WorkoutPrescription): TargetEvent | null {
  if (workout.type !== 'race') return null
  return [...(plan.targetEvent ? [plan.targetEvent] : []), ...(plan.tuneUpEvents ?? [])].find((event) => event.date === workout.date) ?? null
}

export function isCourseAwareRace(plan: CoachingPlan, workout: WorkoutPrescription): boolean {
  const event = raceEventFor(plan, workout)
  return event !== null && hasCoursePacing(event)
}

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
