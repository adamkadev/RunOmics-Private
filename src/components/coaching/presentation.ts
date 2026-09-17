import type { PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'
import type { WorkoutStep, WorkoutStepKind } from '@/domain/activity/types'
import {
  COACHING_TO_ACTIVITY_TYPE,
  type CoachingPlan,
  type WorkoutPrescription,
  type WorkoutSegmentKind,
  type WorkoutTarget,
} from '@/domain/coaching/types'
import { bookends } from '@/domain/training/workoutStructure'
import { formatClock, formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'

const DAY_MS = 86_400_000

function utc(date: string): number {
  return Date.parse(date + 'T00:00:00Z')
}

function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS)
}

function addDays(date: string, days: number): string {
  return new Date(utc(date) + days * DAY_MS).toISOString().slice(0, 10)
}

const MACROCYCLE_SHAPE = { raceWeekDays: 7, base: 0.45, build: 0.35 } as const

export function macrocycleStart(plan: CoachingPlan): string {
  return plan.macrocycleStartDate ?? plan.block.startDate
}

export function macrocyclePhaseRanges(plan: CoachingPlan): PlanPhaseRange[] {
  const start = macrocycleStart(plan)
  const end = plan.targetEvent.date
  const total = daysBetween(start, end) + 1
  if (total < 14) return []

  const runUp = total - MACROCYCLE_SHAPE.raceWeekDays
  const baseDays = Math.max(1, Math.round(runUp * MACROCYCLE_SHAPE.base))
  const buildDays = Math.max(1, Math.round(runUp * MACROCYCLE_SHAPE.build))
  const peakDays = runUp - baseDays - buildDays
  if (peakDays < 1) return []

  const phases: { phase: TrainingPlanPhase; days: number }[] = [
    { phase: 'base', days: baseDays },
    { phase: 'build', days: buildDays },
    { phase: 'peak', days: peakDays },
    { phase: 'raceDay', days: MACROCYCLE_SHAPE.raceWeekDays },
  ]

  let cursor = start
  return phases.map(({ phase, days }, i) => {
    const endDate = i === phases.length - 1 ? end : addDays(cursor, days - 1)
    const range = { phase, startDate: cursor, endDate }
    cursor = addDays(cursor, days)
    return range
  })
}

export function macrocycleWeek(plan: CoachingPlan, today: string): { done: number; total: number } | null {
  const start = macrocycleStart(plan)
  const total = Math.max(1, Math.round(daysBetween(start, plan.targetEvent.date) / 7))
  const done = Math.floor(daysBetween(start, today) / 7) + 1
  return { done: Math.min(Math.max(done, 1), total), total }
}

export function garminAlert(view: PrescriptionView): string | null {
  return view.garminStatus === 'scheduled_different' ? t.coaching.garminOutOfDate : null
}

// A literal ['easy', 'recovery'] exclusion list here missed 'long_run' -
// COACHING_TO_ACTIVITY_TYPE already maps every easy-effort prescription type
// (easy, recovery, long_run) to the 'Base' activity type, so reusing it keeps
// this in sync with that map instead of drifting from it again.
export function isKeyPrescription(workout: WorkoutPrescription): boolean {
  return COACHING_TO_ACTIVITY_TYPE[workout.type] !== 'Base'
}

function segmentSeconds(target: WorkoutTarget): { seconds: number; estimated: boolean } | null {
  if (target.durationSeconds !== undefined) return { seconds: target.durationSeconds, estimated: false }
  if (target.distanceMeters !== undefined && target.paceSecPerKm) {
    const midpoint = (target.paceSecPerKm.min + target.paceSecPerKm.max) / 2
    return { seconds: (target.distanceMeters / 1_000) * midpoint, estimated: true }
  }
  return null
}

function eachSegment(
  workout: WorkoutPrescription,
  visit: (target: WorkoutTarget, kind: WorkoutSegmentKind, rep: number | undefined) => boolean | void
): boolean {
  for (const block of workout.blocks) {
    const repetitions = block.kind === 'repeat' ? block.repetitions : 1
    const steps = block.kind === 'repeat' ? block.steps : [block]
    for (let rep = 1; rep <= repetitions; rep += 1) {
      for (const step of steps) {
        if (visit(step.target, step.kind, block.kind === 'repeat' ? rep : undefined) === false) return false
      }
    }
  }
  return true
}

export function prescriptionSize(workout: WorkoutPrescription): string {
  let meters = 0
  let unpacedSeconds = 0
  let estimated = false

  eachSegment(workout, (target) => {
    if (target.distanceMeters !== undefined) {
      meters += target.distanceMeters
    } else if (target.durationSeconds && target.paceSecPerKm) {
      const midpoint = (target.paceSecPerKm.min + target.paceSecPerKm.max) / 2
      meters += (target.durationSeconds / midpoint) * 1_000
      estimated = true
    } else {
      unpacedSeconds += target.durationSeconds ?? 0
    }
  })

  return [
    meters ? `${estimated ? '~' : ''}${Number((meters / 1000).toFixed(1))} km` : '',
    unpacedSeconds ? formatDurationWords(unpacedSeconds) : '',
  ].filter(Boolean).join(' + ')
}

const STEP_KIND: Record<WorkoutSegmentKind, WorkoutStepKind> = {
  warmup: 'warmup',
  effort: 'effort',
  recovery: 'recovery',
  cooldown: 'cooldown',
  strides: 'effort',
}

function paceSpan(
  workout: WorkoutPrescription,
  include: (kind: WorkoutSegmentKind) => boolean
): string | null {
  let min: number | undefined
  let max: number | undefined

  eachSegment(workout, ({ paceSecPerKm }, kind) => {
    if (!paceSecPerKm || !include(kind)) return
    min = min === undefined ? paceSecPerKm.min : Math.min(min, paceSecPerKm.min)
    max = max === undefined ? paceSecPerKm.max : Math.max(max, paceSecPerKm.max)
  })

  return min !== undefined && max !== undefined ? `${formatClock(min)}–${formatClock(max)}/km` : null
}

/** The pace envelope of the whole session, warm-up and cool-down included. */
export function prescriptionPace(workout: WorkoutPrescription): string | null {
  return paceSpan(workout, () => true)
}

/**
 * The pace of the work only. Collapsing every segment into one span turns a
 * threshold session into `4:20-6:27/km`, a range so wide it prescribes nothing:
 * the slow end is the warm-up and the fast end the reps. On a glanceable row
 * the reps are the session, so the bookends are dropped. Returns null when the
 * coach paced no effort segment, leaving the caller on its zone-band fallback.
 */
export function prescriptionEffortPace(workout: WorkoutPrescription): string | null {
  return paceSpan(workout, (kind) => STEP_KIND[kind] === 'effort')
}

export function prescriptionDuration(workout: WorkoutPrescription): { seconds: number; estimated: boolean } | null {
  if (workout.totalDurationSeconds !== undefined) {
    return { seconds: workout.totalDurationSeconds, estimated: false }
  }

  let seconds = 0
  let estimated = false
  const complete = eachSegment(workout, (target) => {
    const timed = segmentSeconds(target)
    if (!timed) return false
    seconds += timed.seconds
    estimated = estimated || timed.estimated
    return true
  })

  if (!complete || seconds <= 0) return null
  return { seconds: Math.round(seconds), estimated }
}

export function prescriptionDistanceMeters(workout: WorkoutPrescription): number | null {
  if (workout.totalDistanceMeters !== undefined) return workout.totalDistanceMeters

  let meters = 0
  eachSegment(workout, (target) => {
    if (target.distanceMeters !== undefined) meters += target.distanceMeters
  })
  return meters || null
}

export function prescriptionStructure(workout: WorkoutPrescription): WorkoutStep[] | null {
  const steps: { kind: WorkoutStepKind; minutes: number | null; rep?: number; paceSecPerKm?: [number, number] }[] = []

  const drawable = eachSegment(workout, (target, kind, rep) => {
    const stepKind = STEP_KIND[kind]
    const timed = segmentSeconds(target)
    if (!timed && stepKind !== 'warmup' && stepKind !== 'cooldown') return false
    steps.push({
      kind: stepKind,
      minutes: timed ? Math.max(1, Math.round(timed.seconds / 60)) : null,
      ...(rep !== undefined ? { rep } : {}),
      ...(target.paceSecPerKm ? { paceSecPerKm: [target.paceSecPerKm.min, target.paceSecPerKm.max] as [number, number] } : {}),
    })
    return true
  })

  if (!drawable || steps.length <= 1) return null

  if (steps.some((step) => step.minutes === null)) {
    const totalMinutes = workout.totalDurationSeconds ? Math.round(workout.totalDurationSeconds / 60) : null
    const workMinutes = steps.reduce((sum, step) => sum + (step.minutes ?? 0), 0)
    const split = bookends(totalMinutes, workMinutes)
    for (const step of steps) {
      if (step.minutes === null) step.minutes = step.kind === 'warmup' ? split.warmup : split.cooldown
    }
  }

  return steps as WorkoutStep[]
}
