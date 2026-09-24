import type { BootstrapWorkoutDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { WorkoutBlock, WorkoutRepeatBlock, WorkoutSegment } from '@/domain/coaching/types'
import type { CoachingContext } from './context'
import { validateBootstrapDraftSemantics, type BootstrapEvents } from './bootstrapValidation'
import { validateDraftFrequency } from './frequency'
import { intensityBand, validateDraftIntensity } from './intensity'
import { validateDraftVolume, volumeBand } from './volume'

/**
 * Every rule a proposed plan has to satisfy, and which of them apply when.
 *
 * The advisors only build prompts and read answers. Judging an answer happens
 * here, so a reply from the API, a reply pasted from a chat and a change to the
 * live plan all answer to the same rules. The checks themselves stay beside
 * their reasoning - frequency.ts, volume.ts, intensity.ts and
 * bootstrapValidation.ts - and this module is the one place that calls them.
 */

function flattenedSegments(blocks: WorkoutBlock[]): WorkoutSegment[] {
  return blocks.flatMap((block) => block.kind === 'repeat' ? block.steps : [block])
}

function hasStructuredProgression(segments: WorkoutSegment[]): boolean {
  const efforts = segments.filter((segment) => segment.kind === 'effort')
  for (let index = 1; index < efforts.length; index++) {
    const previous = efforts[index - 1]!.target
    const current = efforts[index]!.target
    if (
      previous.paceSecPerKm && current.paceSecPerKm
      && current.paceSecPerKm.min < previous.paceSecPerKm.min
      && current.paceSecPerKm.max < previous.paceSecPerKm.max
    ) return true
    if (previous.hrZone !== undefined && current.hrZone !== undefined && current.hrZone > previous.hrZone) return true
    if (
      previous.hrBpm && current.hrBpm
      && current.hrBpm.min > previous.hrBpm.min
      && current.hrBpm.max > previous.hrBpm.max
    ) return true
  }
  return false
}

/**
 * How one session is written, whichever path wrote it: strides as a repeat
 * group with recovery and a timed, HR-free stride; hills by effort rather than
 * by a pace the gradient makes meaningless; and "progressive" only when the
 * targets actually progress.
 */
export function validateWorkoutDraft(workout: BootstrapWorkoutDraft, label: string): void {
  const mentionsStrides = /\bstrides?\b/i.test([workout.title, workout.description, ...(workout.notes ?? [])].join('\n'))
  const strideRepeats = workout.blocks.filter((block): block is WorkoutRepeatBlock =>
    block.kind === 'repeat' && block.steps.some((step) => step.kind === 'strides')
  )
  const segments = flattenedSegments(workout.blocks)
  if (workout.blocks.some((block) => block.kind === 'strides')) {
    throw new Error(`${label}.blocks: standalone strides are not supported; use a repeat group`)
  }
  if (mentionsStrides && strideRepeats.length === 0) {
    throw new Error(`${label}.blocks: strides must be prescribed as a repeat group`)
  }
  for (const block of strideRepeats) {
    if (block.repetitions < 2) throw new Error(`${label}.blocks: strides repeat group must contain multiple repetitions`)
    if (!block.steps.some((step) => step.kind === 'recovery')) {
      throw new Error(`${label}.blocks: strides repeat group must include recovery`)
    }
    if (block.steps.some((step) => step.kind === 'strides' && step.target.durationSeconds === undefined)) {
      throw new Error(`${label}.blocks: each strides step must have a durationSeconds target`)
    }
    if (block.steps.some((step) => step.kind === 'strides' && (step.target.hrBpm !== undefined || step.target.hrZone !== undefined))) {
      throw new Error(`${label}.blocks: short strides must use pace, effort, or form guidance rather than an HR target`)
    }
  }

  const workoutProse = [
    workout.title,
    workout.description,
    ...(workout.notes ?? []),
    ...segments.flatMap((segment) => segment.notes ?? []),
  ].join('\n')
  const isHillWorkout = workout.type !== 'race'
    && /\b(?:hill|hills|uphill|incline)\b|(?:côte|côtes|montee|montée|montées)/i.test(workoutProse)
  if (isHillWorkout && segments.some((segment) =>
    (segment.kind === 'effort' || segment.kind === 'strides')
    && segment.target.paceSecPerKm !== undefined
  )) {
    throw new Error(`${label}.blocks: hill efforts must use effort/RPE guidance, not a rigid pace target`)
  }

  const claimsProgression = /\bprogress(?:ive|ion|if|ifs|ives?|ivement)\b/i.test(workoutProse)
  if (claimsProgression && !hasStructuredProgression(segments)) {
    throw new Error(`${label}.blocks: a progressive workout must contain an actual structured intensity progression`)
  }
}

/** Available weekdays are the athlete's, not a preference to be traded against volume. */
export function validateAvailableWeekdays(workouts: Pick<BootstrapWorkoutDraft, 'date'>[], availableWeekdays: number[]): void {
  for (const workout of workouts) {
    if (!availableWeekdays.includes(new Date(`${workout.date}T00:00:00Z`).getUTCDay())) {
      throw new Error(`${workout.date} is outside the available weekdays`)
    }
  }
}

export interface BootstrapRules {
  availableWeekdays: number[]
  runsPerWeek?: number
  context: CoachingContext
  events: BootstrapEvents
}

/** A block being written answers to every rule, in the order a draft meets them. */
export function validateBootstrapDraft(draft: CoachingPlanDraft, rules: BootstrapRules): void {
  draft.weeks.forEach((week, weekIndex) => week.workouts.forEach((workout, workoutIndex) =>
    validateWorkoutDraft(workout, `plan.weeks[${weekIndex}].workouts[${workoutIndex}]`)
  ))
  validateDraftFrequency(draft, rules.runsPerWeek)
  validateDraftVolume(draft, volumeBand(rules.context.trainingHistory), rules.availableWeekdays)
  validateDraftIntensity(draft, intensityBand(rules.context.athlete.thresholdPaceSecPerKm), rules.availableWeekdays)
  validateBootstrapDraftSemantics(draft, rules.events, rules.context)
  validateAvailableWeekdays(draft.weeks.flatMap((week) => week.workouts), rules.availableWeekdays)
}
