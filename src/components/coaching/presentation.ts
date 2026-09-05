import type { PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'
import type { CoachingPlan, WorkoutPrescription, WorkoutTarget } from '@/domain/coaching/types'
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
