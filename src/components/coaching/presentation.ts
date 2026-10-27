import { DAY_MS, isoDate, startOfWeek } from '@/lib/calendarDate'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import type { WorkoutStep, WorkoutStepKind } from '@/domain/activity/types'
import {
  COACHING_TO_ACTIVITY_TYPE,
  type CoachingPlan,
  type WorkoutPrescription,
  type WorkoutSegmentKind,
  type WorkoutTarget,
} from '@/domain/coaching/types'
import { macrocyclePhases } from '@/domain/coaching/macrocycle'
import { prescriptionMeters } from '@/domain/coaching/sessionDistance'
import { bookends } from '@/domain/training/workoutStructure'
import type { SessionHrTarget } from '@/domain/training/hrTarget'
import { formatClock } from '@/lib/formatters'

function utc(date: string): number {
  return Date.parse(date + 'T00:00:00Z')
}

function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS)
}

/** The dates the macrocycle is measured between - all a phase track reads of a plan. */
export type MacrocycleSpan = Pick<CoachingPlan, 'macrocycleStartDate'> & {
  block: Pick<CoachingPlan['block'], 'startDate'>
  targetEvent?: Pick<NonNullable<CoachingPlan['targetEvent']>, 'date'>
}

export function macrocycleStart(plan: MacrocycleSpan): string {
  return plan.macrocycleStartDate ?? plan.block.startDate
}

export function macrocyclePhaseRanges(plan: MacrocycleSpan): PlanPhaseRange[] {
  // General preparation has no race to divide the season toward.
  return plan.targetEvent ? macrocyclePhases(macrocycleStart(plan), plan.targetEvent.date) : []
}

/** Counted by the Monday of the date's week, so Plan (asking with a Monday) and Goals (asking with today) agree. */
export function macrocycleWeek(plan: MacrocycleSpan, date: string): { done: number; total: number } | null {
  if (!plan.targetEvent) return null
  const start = macrocycleStart(plan)
  const total = Math.max(1, Math.round(daysBetween(start, plan.targetEvent.date) / 7))
  const monday = isoDate(startOfWeek(new Date(`${date}T00:00:00`)))
  const done = Math.floor(daysBetween(start, monday) / 7) + 1
  return { done: Math.min(Math.max(done, 1), total), total }
}

/** Monday weeks from the start, as coachingPrompt counts them. */
export function preparationWeek(plan: MacrocycleSpan, date: string): number | null {
  if (plan.targetEvent) return null
  const startMonday = isoDate(startOfWeek(new Date(`${macrocycleStart(plan)}T00:00:00`)))
  const monday = isoDate(startOfWeek(new Date(`${date}T00:00:00`)))
  const week = Math.floor(daysBetween(startMonday, monday) / 7) + 1
  return week >= 1 ? week : null
}

// Reuses the map that sends every easy-effort type (easy, recovery, long_run) to 'Base', so a literal list cannot drift from it.
export function isKeyPrescription(workout: Pick<WorkoutPrescription, 'type'>): boolean {
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

type Segmented = Pick<WorkoutPrescription, 'blocks'>

function eachSegment(
  workout: Segmented,
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

const STEP_KIND: Record<WorkoutSegmentKind, WorkoutStepKind> = {
  warmup: 'warmup',
  effort: 'effort',
  recovery: 'recovery',
  cooldown: 'cooldown',
  strides: 'effort',
}

function paceSpan(
  workout: Segmented,
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

export function prescriptionPace(workout: Segmented): string | null {
  return paceSpan(workout, () => true)
}

/** The work only: a span over the warm-up and the reps together is too wide to prescribe anything. */
export function prescriptionEffortPace(workout: Segmented): string | null {
  return paceSpan(workout, (kind) => STEP_KIND[kind] === 'effort')
}

export function prescriptionHr(workout: Segmented): SessionHrTarget | null {
  const caps: number[] = []
  const zones: number[] = []

  eachSegment(workout, ({ hrBpm, hrZone }, kind) => {
    if (STEP_KIND[kind] !== 'effort') return
    if (hrBpm) caps.push(hrBpm.max)
    if (hrZone !== undefined) zones.push(hrZone)
  })

  const capBpm = caps.length > 0 ? Math.max(...caps) : null
  const zone = zones.length > 0 ? Math.max(...zones) : null
  return capBpm === null && zone === null ? null : { capBpm, zone }
}

export function prescriptionDuration(
  workout: Segmented & Pick<WorkoutPrescription, 'totalDurationSeconds'>
): { seconds: number; estimated: boolean } | null {
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

export function prescriptionDistanceMeters(workout: Segmented & Pick<WorkoutPrescription, 'totalDistanceMeters'>): number | null {
  return prescriptionMeters(workout)
}

export function prescriptionStructure(workout: Segmented & Pick<WorkoutPrescription, 'totalDurationSeconds'>): WorkoutStep[] | null {
  const steps: { kind: WorkoutStepKind; minutes: number | null; seconds?: number; rep?: number; paceSecPerKm?: [number, number] }[] = []

  const drawable = eachSegment(workout, (target, kind, rep) => {
    const stepKind = STEP_KIND[kind]
    const timed = segmentSeconds(target)
    if (!timed && stepKind !== 'warmup' && stepKind !== 'cooldown') return false
    steps.push({
      kind: stepKind,
      minutes: timed ? Math.max(1, Math.round(timed.seconds / 60)) : null,
      ...(timed ? { seconds: Math.round(timed.seconds) } : {}),
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
