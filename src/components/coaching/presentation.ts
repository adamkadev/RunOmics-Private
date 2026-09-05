import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'
import type { CoachingPlan, TrainingWeek, WorkoutPrescription, WorkoutTarget } from '@/domain/coaching/types'
import { formatClock, formatDurationWords } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * Coaching weeks are placed in the Plan's own phase vocabulary
 * (Base/Build/Peak/Taper/Race) rather than a second set of names, so the
 * progression track reads identically whether it is driven by Garmin Coach or
 * by the adaptive block.
 */
function weekPhase(week: TrainingWeek): TrainingPlanPhase | null {
  const focus = week.focus.toLowerCase()
  if (week.workouts.some(w => w.type === 'race' && w.status !== 'cancelled')) return 'raceDay'
  if (/taper|affût|affut/.test(focus)) return 'taper'
  if (/recovery|post.race|récup|recup/.test(focus)) return 'base'
  if (/sharpen|specific|spécifi|tune.up|5k|5 km/.test(focus)) return 'peak'
  if (/build|threshold|aerobic|aérobie|seuil|endur|volume/.test(focus)) return 'build'
  return null
}

/** The week's phase name, falling back to its own focus text when none is recognised. */
export function coachingPhase(week: TrainingWeek): string {
  const phase = weekPhase(week)
  return phase ? t.plan.phaseTrack[phase] : week.focus
}

/**
 * The block's weeks collapsed into consecutive phase segments, so the existing
 * progression track can render Base -> Build -> Peak -> Taper from the plan's
 * own weekly focus rather than from a second hardcoded training model. Weeks
 * whose focus names no known phase are folded into the run before them, which
 * keeps the track continuous instead of sprouting one segment per week.
 */
export function coachingPhaseRanges(plan: CoachingPlan): PlanPhaseRange[] {
  const ranges: PlanPhaseRange[] = []
  for (const week of plan.weeks) {
    const phase = weekPhase(week)
    const previous = ranges[ranges.length - 1]
    if (!phase || (previous && previous.phase === phase)) {
      if (previous) previous.endDate = week.endDate
      continue
    }
    ranges.push({ phase, startDate: week.startDate, endDate: week.endDate })
  }
  return ranges
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
