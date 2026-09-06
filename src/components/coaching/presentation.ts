import type { PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'
import type { WorkoutStep, WorkoutStepKind } from '@/domain/activity/types'
import type {
  CoachingPlan,
  WorkoutPrescription,
  WorkoutSegmentKind,
  WorkoutTarget,
} from '@/domain/coaching/types'
import { bookends } from '@/domain/training/workoutStructure'
import { formatClock, formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'

const DAY_MS = 86_400_000

// UTC throughout: a macrocycle spans a DST change, and local-midnight maths
// drifts a day either side of it.
function utc(date: string): number {
  return Date.parse(date + 'T00:00:00Z')
}

function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS)
}

function addDays(date: string, days: number): string {
  return new Date(utc(date) + days * DAY_MS).toISOString().slice(0, 10)
}

/**
 * Shape of the macrocycle running from the start of training to the primary
 * target. Configured here at macrocycle level: the closing week is race week,
 * and the run-up splits base-heavy. These are deliberately NOT read from the
 * rolling block's TrainingWeek entries - a week's focus describes that one
 * generated week, while these four phases span the whole journey to the target.
 */
const MACROCYCLE_SHAPE = { raceWeekDays: 7, base: 0.45, build: 0.35 } as const

/** Training start for the primary target: the macrocycle anchor, or today's block. */
export function macrocycleStart(plan: CoachingPlan): string {
  return plan.macrocycleStartDate ?? plan.block.startDate
}

/**
 * Base -> Build -> Peak -> Race across the whole run-up to the primary target,
 * derived from dates rather than from the four weeks of the current block.
 */
export function macrocyclePhaseRanges(plan: CoachingPlan): PlanPhaseRange[] {
  const start = macrocycleStart(plan)
  const end = plan.targetEvent.date
  const total = daysBetween(start, end) + 1
  if (total < 14) return []

  // The bar ends on race day itself, so the closing week is carved off first.
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
    // The final segment is pinned to race day so rounding never lands short.
    const endDate = i === phases.length - 1 ? end : addDays(cursor, days - 1)
    const range = { phase, startDate: cursor, endDate }
    cursor = addDays(cursor, days)
    return range
  })
}

/** Week X of Y toward the primary target, counted from the macrocycle dates. */
export function macrocycleWeek(plan: CoachingPlan, today: string): { done: number; total: number } | null {
  const start = macrocycleStart(plan)
  // Race day closes the final week rather than opening a new one.
  const total = Math.max(1, Math.round(daysBetween(start, plan.targetEvent.date) / 7))
  const done = Math.floor(daysBetween(start, today) / 7) + 1
  return { done: Math.min(Math.max(done, 1), total), total }
}

/**
 * Coach workouts are expected to reach Garmin, so a healthy sync says nothing at
 * all. Only a state the athlete has to act on is worth a line on the Plan page -
 * today that means Garmin holding a session that no longer matches the
 * prescription. The sync state itself is untouched and still kept in full for
 * idempotency and diagnostics.
 */
export function garminAlert(view: PrescriptionView): string | null {
  return view.garminStatus === 'scheduled_different' ? t.coaching.garminOutOfDate : null
}

/** Prefer explicit distance; estimate timed paced segments, never unpaced effort. */
export function prescriptionSize(workout: WorkoutPrescription): string {
  let meters = 0, unpacedSeconds = 0, estimated = false
  for (const block of workout.blocks) {
    const count = block.kind === 'repeat' ? block.repetitions : 1
    for (const segment of block.kind === 'repeat' ? block.steps : [block]) {
      const target = segment.target
      if (target.distanceMeters !== undefined) meters += target.distanceMeters * count
      else if (target.durationSeconds && target.paceSecPerKm) {
        meters += target.durationSeconds / ((target.paceSecPerKm.min + target.paceSecPerKm.max) / 2) * 1000 * count
        estimated = true
      } else unpacedSeconds += (target.durationSeconds ?? 0) * count
    }
  }
  return [meters ? `${estimated ? '~' : ''}${Number((meters / 1000).toFixed(1))} km` : '', unpacedSeconds ? formatDurationWords(unpacedSeconds) : ''].filter(Boolean).join(' + ')
}

/** The widest pace band the session asks for, for the one-line summary. */
export function prescriptionPace(workout: WorkoutPrescription): string | null {
  let min: number | undefined, max: number | undefined
  for (const block of workout.blocks) {
    for (const segment of block.kind === 'repeat' ? block.steps : [block]) {
      const pace = segment.target.paceSecPerKm
      if (!pace) continue
      min = min === undefined ? pace.min : Math.min(min, pace.min)
      max = max === undefined ? pace.max : Math.max(max, pace.max)
    }
  }
  return min !== undefined && max !== undefined ? `${formatClock(min)}–${formatClock(max)}/km` : null
}

/** Title line under a day: what the session is and how big it is. */
export function prescriptionSummary(workout: WorkoutPrescription): string {
  return [prescriptionSize(workout), prescriptionPace(workout)].filter(Boolean).join(' · ')
}

/** Easy and recovery runs fill the week; everything else is what the week is built around. */
export function isKeyPrescription(workout: WorkoutPrescription): boolean {
  return !['easy', 'recovery'].includes(workout.type)
}

export function prescriptionTarget(target: WorkoutTarget): string {
  return [
    target.distanceMeters !== undefined ? `${Number((target.distanceMeters / 1000).toFixed(2))} km` : '',
    target.durationSeconds !== undefined ? (target.durationSeconds < 60 ? `${target.durationSeconds}s` : formatDurationWords(target.durationSeconds)) : '',
    target.paceSecPerKm ? `${formatClock(target.paceSecPerKm.min)}–${formatClock(target.paceSecPerKm.max)}/km` : '',
    target.hrBpm ? `${target.hrBpm.min}–${target.hrBpm.max} bpm` : '',
    target.hrZone !== undefined ? `Z${target.hrZone}` : '',
  ].filter(Boolean).join(' · ')
}

// --- Deriving the numbers the Plan UI shows ---------------------------------
//
// A prescription states what the athlete should do, not how long it takes: the
// coach gives "4 km @ 5:50-6:27/km" and the Plan row has to say "~25 min". The
// three functions below are that derivation, and they share one rule - a value
// is either computed from what the prescription actually states or it is not
// shown at all. Nothing here guesses at a pace, a distance or a duration.

/**
 * A segment's duration: stated outright, or implied by a distance run at a
 * stated pace (its midpoint). A distance with no pace is neither, and the
 * caller decides what to do about it.
 */
function segmentSeconds(target: WorkoutTarget): { seconds: number; estimated: boolean } | null {
  if (target.durationSeconds !== undefined) return { seconds: target.durationSeconds, estimated: false }
  if (target.distanceMeters !== undefined && target.paceSecPerKm) {
    const midpoint = (target.paceSecPerKm.min + target.paceSecPerKm.max) / 2
    return { seconds: (target.distanceMeters / 1_000) * midpoint, estimated: true }
  }
  return null
}

/** Every segment in running order, with repeat blocks expanded into their reps. */
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

/**
 * How long the session takes. An explicit total wins; otherwise every segment
 * is added up, repeats multiplied and timed recoveries and strides included.
 * `estimated` is true as soon as any part of it came from distance and pace,
 * and the UI marks such a value with a "~". One segment that can be neither
 * timed nor paced makes the total a guess, so no duration is offered at all.
 */
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

/** How far the session goes, from an explicit total or the stated distances. */
export function prescriptionDistanceMeters(workout: WorkoutPrescription): number | null {
  if (workout.totalDistanceMeters !== undefined) return workout.totalDistanceMeters

  let meters = 0
  eachSegment(workout, (target) => {
    if (target.distanceMeters !== undefined) meters += target.distanceMeters
  })
  return meters || null
}

// A structure bar has four intensities; strides are short accelerations run
// inside the session's own effort, so they share that one.
const STEP_KIND: Record<WorkoutSegmentKind, WorkoutStepKind> = {
  warmup: 'warmup',
  effort: 'effort',
  recovery: 'recovery',
  cooldown: 'cooldown',
  strides: 'effort',
}

/**
 * The prescription as the steps the Plan's own WorkoutStructureBars and
 * WorkoutStepList already draw, so a coached session and a Garmin one render
 * through exactly the same structure UI.
 *
 * Returns null for a single continuous block: the row and the sheet's chips
 * already state its distance, duration and pace, and one full-height bar over
 * one line repeating those numbers is noise, not structure.
 */
export function prescriptionStructure(workout: WorkoutPrescription): WorkoutStep[] | null {
  const steps: { kind: WorkoutStepKind; minutes: number | null; rep?: number; paceSecPerKm?: [number, number] }[] = []

  const drawable = eachSegment(workout, (target, kind, rep) => {
    const stepKind = STEP_KIND[kind]
    const timed = segmentSeconds(target)
    // Only the bookends may be left open. A warm-up given as "2 km" is run at
    // whatever pace the rest of the session leaves it, and bookends() splits
    // that remainder the same way it does for a parsed Garmin session. An
    // untimed, unpaced effort or recovery has no such fallback, so rather than
    // invent a width for it the shape is not drawn at all.
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
