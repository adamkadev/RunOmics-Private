import type { BootstrapWorkoutDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type {
  CoachingPlan,
  TrainingWeek,
  WorkoutBlock,
  WorkoutPrescription,
  WorkoutRepeatBlock,
  WorkoutSegment,
} from '@/domain/coaching/types'
import type { CoachingContext } from './context'
import { validateBootstrapDraftSemantics, type BootstrapEvents } from './bootstrapValidation'
import { validateDraftFrequency } from './frequency'
import { intensityBand, validateDraftIntensity } from './intensity'
import { validateDraftVolume, volumeBand } from './volume'
import { validateDraftNames, validateWorkoutName } from './workoutNames'

/** The one place that judges a plan, so an API reply, a pasted chat reply and a live-plan change answer to the same rules. */

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

export function validateWorkoutDraft(workout: BootstrapWorkoutDraft, label: string): void {
  const mentionsStrides = /\bstrides?\b|\bacc[ée]l[ée]rations\b|\blignes droites\b/i.test([workout.title, workout.description, ...(workout.notes ?? [])].join('\n'))
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
  // The hill is in the repetitions; the easy running around them keeps its pace.
  const repeated = workout.blocks.flatMap((block) => block.kind === 'repeat' ? block.steps : [])
  const hillEfforts = [...repeated, ...workout.blocks.filter((block) => block.kind === 'strides')]
  if (isHillWorkout && hillEfforts.some((segment) =>
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

export function validateBootstrapDraft(draft: CoachingPlanDraft, rules: BootstrapRules): void {
  draft.weeks.forEach((week, weekIndex) => week.workouts.forEach((workout, workoutIndex) =>
    validateWorkoutDraft(workout, `plan.weeks[${weekIndex}].workouts[${workoutIndex}]`)
  ))
  validateDraftFrequency(draft, rules.runsPerWeek)
  validateDraftVolume(draft, volumeBand(rules.context.trainingHistory), rules.availableWeekdays)
  validateDraftIntensity(draft, intensityBand(rules.context.athlete.thresholdPaceSecPerKm), rules.availableWeekdays)
  validateBootstrapDraftSemantics(draft, rules.events, rules.context)
  validateAvailableWeekdays(draft.weeks.flatMap((week) => week.workouts), rules.availableWeekdays)
  // Last: a name is the cheapest thing to put right, so the substance is
  // judged first and a repair is asked for it first.
  validateDraftNames(draft)
}

function active(week: TrainingWeek): WorkoutPrescription[] {
  return week.workouts.filter((workout) => workout.status !== 'cancelled')
}

function asDraft(plan: CoachingPlan): CoachingPlanDraft {
  return {
    name: plan.block.name,
    focus: plan.block.focus,
    weeks: plan.weeks.map((week) => ({ startDate: week.startDate, endDate: week.endDate, focus: week.focus, workouts: active(week) })),
  }
}

/** Judged on what the change added, so a week it did not add to is never refused for how it already stood. */
function validateAdaptedFrequency(before: CoachingPlan, after: CoachingPlan, changed: WorkoutPrescription[], runsPerWeek: number): void {
  const running = after.weeks.flatMap(active)
  for (const workout of changed) {
    if (running.some((other) => other.id !== workout.id && other.date === workout.date)) {
      throw new Error(`${workout.date} already has a run; one run per day, so change that session instead of adding another`)
    }
  }
  const countBefore = new Map(before.weeks.map((week) => [week.startDate, active(week).length]))
  for (const week of after.weeks) {
    const count = active(week).length
    if (count > runsPerWeek && count > (countBefore.get(week.startDate) ?? 0)) {
      throw new Error(`Week ${week.startDate} would hold ${count} runs against ${runsPerWeek} a week`)
    }
  }
}

/**
 * A change may always take load away - that is what an adaptation for fatigue or illness is for -
 * but whatever it adds must fit the bootstrap bounds. Rules that demand a minimum stay with bootstrap.
 */
export function validateAdaptation(before: CoachingPlan, after: CoachingPlan, context: CoachingContext, options: { guideChange?: boolean } = {}): void {
  const previous = new Map(before.weeks.flatMap((week) => week.workouts).map((workout) => [workout.id, workout]))
  const changed = after.weeks.flatMap(active).filter((workout) => {
    const prior = previous.get(workout.id)
    return prior === undefined || JSON.stringify(prior) !== JSON.stringify(workout)
  })
  for (const workout of changed) validateWorkoutDraft(workout, `workout ${workout.id}`)

  const preferences = after.trainingPreferences
  const weekdays = preferences?.availableWeekdays ?? []
  if (preferences) validateAvailableWeekdays(changed, weekdays)
  if (preferences?.runsPerWeek !== undefined) validateAdaptedFrequency(before, after, changed, preferences.runsPerWeek)

  const draft = asDraft(after)
  const prior = asDraft(before)
  validateDraftVolume(draft, volumeBand(context.trainingHistory), weekdays, prior)
  validateDraftIntensity(draft, intensityBand(context.athlete.thresholdPaceSecPerKm), weekdays, prior, options)

  // A title the plan already held keeps the rules it was written under, wherever its session moved.
  const titles = new Set(before.weeks.flatMap((week) => week.workouts).map((workout) => workout.title))
  for (const workout of changed) validateWorkoutName(workout, `workout ${workout.id}`, { titleAsWritten: titles.has(workout.title) })
}
