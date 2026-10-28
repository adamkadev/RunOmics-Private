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
import { blockGuideProposals } from './autoregulation'
import { validateBootstrapDraftSemantics, type BootstrapEvents } from './bootstrapValidation'
import { validateDraftFrequency } from './frequency'
import { intensityBand, validateDraftIntensity } from './intensity'
import { blockWeekTargets, validateDraftVolume, volumeBand, type WeekTarget } from './volume'
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

const NAMES_A_HILL = /(?<!\p{L})(?:hills?|uphill|incline|c[oô]tes?|mont[ée]es?(?!\s+en\s+charge))(?!\p{L})/iu

/** Read where the repetitions are named, so a route's climb in the description or « montée en charge » is no hill session. */
function namesHillRepetitions(workout: BootstrapWorkoutDraft, efforts: WorkoutSegment[]): boolean {
  if (workout.type === 'race') return false
  const named = [workout.title, workout.shortName ?? '', ...(workout.structure?.extras ?? []), ...efforts.flatMap((segment) => segment.notes ?? [])]
  return named.some((text) => NAMES_A_HILL.test(text))
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
  // The hill is in the repetitions; the easy running around them keeps its pace.
  const repeated = workout.blocks.flatMap((block) => block.kind === 'repeat' ? block.steps : [])
  const hillEfforts = [...repeated, ...workout.blocks.filter((block): block is WorkoutSegment => block.kind === 'strides')]
  if (namesHillRepetitions(workout, hillEfforts) && hillEfforts.some((segment) =>
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
  guidance?: string
}

/** The guidance's own words, so a stop line the planner writes anyway goes back to it rather than to the athlete. */
export function asksNoStopSignals(guidance: string | undefined): boolean {
  return guidance !== undefined && /\bno stop signals?\b/i.test(guidance)
}

const STOP_SIGNAL = /(?<!\p{L})(?:stop signals?|signaux d'arrêt|stop and see|stop the session|arrête(?:r)? la séance|arrête si|fuites?|pesanteur|leak(?:s|ing)?|heaviness|dragging|urgency|incontinence|pelvi(?:c|en|enne)|périnée|perineum|sage-femme|midwife)(?!\p{L})/iu

type LabelledText = [label: string, text: string | undefined]

function workoutTexts(workout: BootstrapWorkoutDraft): string[] {
  const steps = workout.blocks.flatMap((block) => block.kind === 'repeat' ? block.steps : [block])
  return [workout.title, workout.description, ...(workout.notes ?? []), ...steps.flatMap((step) => step.notes ?? [])]
}

function refuseStopSignals(texts: LabelledText[]): void {
  const found = texts.find(([, text]) => text !== undefined && STOP_SIGNAL.test(text))
  if (found) throw new Error(`${found[0]}: the guidance asks for no stop signals; write no stop rule or symptom warning`)
}

function validateNoStopSignals(draft: CoachingPlanDraft): void {
  const texts: LabelledText[] = [['plan.name', draft.name], ['plan.focus', draft.focus]]
  draft.weeks.forEach((week, weekIndex) => {
    texts.push([`plan.weeks[${weekIndex}].focus`, week.focus], [`plan.weeks[${weekIndex}].reducedVolume`, week.reducedVolume?.explanation])
    week.workouts.forEach((workout, workoutIndex) => {
      for (const text of workoutTexts(workout)) texts.push([`plan.weeks[${weekIndex}].workouts[${workoutIndex}]`, text])
    })
  })
  refuseStopSignals(texts)
}

/** Only what the change wrote: a session it reschedules keeps the words it was written with. */
function validateAdaptedStopSignals(before: CoachingPlan, after: CoachingPlan, changed: WorkoutPrescription[]): void {
  const previous = new Map(before.weeks.flatMap((week) => week.workouts).map((workout) => [workout.id, workout]))
  const texts: LabelledText[] = []
  if (after.block.name !== before.block.name) texts.push(['plan.name', after.block.name])
  if (after.block.focus !== before.block.focus) texts.push(['plan.focus', after.block.focus])
  const focuses = new Set(before.weeks.map((week) => week.focus))
  for (const week of after.weeks) if (!focuses.has(week.focus)) texts.push([`week ${week.startDate}.focus`, week.focus])
  for (const workout of changed) {
    const prior = previous.get(workout.id)
    const written = new Set(prior ? workoutTexts(prior) : [])
    for (const text of workoutTexts(workout)) if (!written.has(text)) texts.push([`workout ${workout.id}`, text])
  }
  refuseStopSignals(texts)
}

/** The watch executes one target a step and pace wins over a zone; notes on a step are unreadable mid-run. */
function validateReturnTargets(draft: CoachingPlanDraft): void {
  draft.weeks.forEach((week, weekIndex) => week.workouts.forEach((workout, workoutIndex) => {
    const label = `plan.weeks[${weekIndex}].workouts[${workoutIndex}]`
    if (workout.notes?.length) {
      throw new Error(`${label}.notes: a return keeps the watch to its one-line description; put the guide in week.focus`)
    }
    for (const step of workout.blocks.flatMap((block) => block.kind === 'repeat' ? block.steps : [block])) {
      if (step.notes?.length) {
        throw new Error(`${label}.blocks: a step in a return carries no notes, so the watch screen stays readable; put the guide in week.focus`)
      }
      const { paceSecPerKm, hrBpm, hrZone } = step.target
      if (step.kind === 'recovery' && (paceSecPerKm || hrBpm || hrZone !== undefined)) {
        throw new Error(`${label}.blocks: a walk break in a return carries no pace or heart-rate target`)
      }
      if (paceSecPerKm && (hrBpm || hrZone !== undefined)) {
        throw new Error(`${label}.blocks: give a running interval its heart-rate zone or its pace range, not both; the watch executes the pace`)
      }
    }
  }))
}

const RETURN_TYPES = new Set<BootstrapWorkoutDraft['type']>(['easy', 'recovery'])
const NAMES_A_LONG_RUN = /\blong run\b|\bsortie longue\b/i
const GUIDANCE_PACE = /(?<!\d)(\d{1,2})[:'’](\d{2})(?=[^.\n]{0,20}?(?:\/\s?km|\b(?:per|par|au) km\b))/gi
const GUIDANCE_BPM = /(?<!\d)(\d{2,3})(?:\s*(?:-|–|à|to)\s*(\d{2,3}))?\s*bpm\b/gi
/** Garmin's zone 2, the top of easy running. */
const EASY_HR_ZONE = 2

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

interface ReturnLimits {
  fastestSecPerKm: { pace: number; source: string } | null
  highestBpm: { bpm: number; source: string } | null
}

/** The guidance's own figures first, since a clinician may set them; the athlete's easy zone without them. */
function returnLimits(guidance: string | undefined, context: CoachingContext): ReturnLimits {
  const paces = [...(guidance ?? '').matchAll(GUIDANCE_PACE)]
    .filter(([, , seconds]) => Number(seconds) < 60)
    .map(([, minutes, seconds]) => Number(minutes) * 60 + Number(seconds))
  const easy = context.athlete.trainingZones?.zones.find((zone) => zone.key === 'easy')
  const bpms = [...(guidance ?? '').matchAll(GUIDANCE_BPM)].flatMap(([, low, high]) => [Number(low), ...(high ? [Number(high)] : [])])
  const zoneThreeFloor = context.athlete.hrZoneBoundsBpm?.[EASY_HR_ZONE]
  return {
    fastestSecPerKm: paces.length > 0
      ? { pace: Math.min(...paces), source: 'the guidance' }
      : easy ? { pace: easy.paceMinSecPerKm, source: 'the easy zone' } : null,
    highestBpm: bpms.length > 0
      ? { bpm: Math.max(...bpms), source: 'the guidance' }
      : zoneThreeFloor !== undefined ? { bpm: zoneThreeFloor, source: 'zone 2' } : null,
  }
}

/** The intensity checks read a threshold pace a returning athlete may not have, so a return is held to easy running here. */
function validateReturnSessions(workouts: [label: string, workout: BootstrapWorkoutDraft][], limits: ReturnLimits): void {
  for (const [label, workout] of workouts) {
    if (!RETURN_TYPES.has(workout.type)) {
      throw new Error(`${label}: a return prescribes easy or recovery running only, never ${workout.type}`)
    }
    if (NAMES_A_LONG_RUN.test(workout.title)) throw new Error(`${label}: no long run while returning`)
    for (const step of flattenedSegments(workout.blocks)) {
      if (step.kind === 'strides') throw new Error(`${label}.blocks: no strides while returning`)
      const { paceSecPerKm, hrZone, hrBpm } = step.target
      const fastest = limits.fastestSecPerKm
      if (paceSecPerKm && fastest && paceSecPerKm.min < fastest.pace) {
        throw new Error(`${label}.blocks: ${clock(paceSecPerKm.min)}/km is faster than ${fastest.source} allows (${clock(fastest.pace)}/km); a return runs no faster`)
      }
      if (hrZone !== undefined && hrZone > EASY_HR_ZONE) {
        throw new Error(`${label}.blocks: zone ${hrZone} is above easy running; a return stays in zone ${EASY_HR_ZONE} at most`)
      }
      const highest = limits.highestBpm
      if (hrBpm && highest && hrBpm.max > highest.bpm) {
        throw new Error(`${label}.blocks: ${hrBpm.max} bpm is above ${highest.source} (${highest.bpm} bpm); a return runs no harder`)
      }
    }
  }
}

/** Case, accents, punctuation and the name's own signs ("·", "×", "′") tell no two lines apart for a reader. */
function plainWords(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

const QUALITY_TYPES = new Set<BootstrapWorkoutDraft['type']>(['tempo', 'threshold', 'vo2max', 'anaerobic', 'sprint'])

export function validateDescriptionNotTitle(workout: Pick<BootstrapWorkoutDraft, 'title' | 'description'>, label: string): void {
  if (workout.description && plainWords(workout.description) === plainWords(workout.title)) {
    throw new Error(`${label}.description: it repeats the title; say in one line what is specific to this session this week`)
  }
}

/** An easy run's cue may hold all block, but a quality session's place in it moves; a return's one line is set by its own rules. */
export function validateWorkoutDescriptions(draft: CoachingPlanDraft, returning: boolean): void {
  const firstWeek = new Map<string, number>()
  draft.weeks.forEach((week, weekIndex) => week.workouts.forEach((workout, workoutIndex) => {
    const label = `plan.weeks[${weekIndex}].workouts[${workoutIndex}]`
    validateDescriptionNotTitle(workout, label)
    const words = plainWords(workout.description)
    if (returning || !words || !QUALITY_TYPES.has(workout.type)) return
    const first = firstWeek.get(words)
    if (first === undefined) firstWeek.set(words, weekIndex)
    else if (first !== weekIndex) {
      throw new Error(`${label}.description: word for word the description of a session in plan.weeks[${first}]; say what is specific to this one this week`)
    }
  }))
}

/** "propos" opens the word in English and French alike, so the check needs no language of its own. */
const NAMES_A_PROPOSAL = /propos/i

/** Pace figures stay out of the focus, so it names the proposal and the app shows its guides from the block. */
export function validateProposalsNamed(draft: CoachingPlanDraft, context: CoachingContext): void {
  const open = blockGuideProposals(context.autoregulation, draft.weeks.flatMap((week) => week.workouts)).filter((proposal) => !proposal.adopted)
  if (open.length === 0 || NAMES_A_PROPOSAL.test(draft.focus)) return
  const named = open.map((proposal) => `${proposal.repClass} repetitions from ${proposal.source === 'sessions' ? 'two agreeing sessions' : 'the 5K check'}`)
  throw new Error(`plan.focus: name the open pace-guide proposal (${named.join('; ')}) so the athlete can accept it, without stating a pace`)
}

/** Only a general block for an athlete with controlled threshold facts is written to the 3 + 1 targets. */
export function draftWeekTargets(
  weeks: Pick<CoachingPlanDraft['weeks'][number], 'startDate' | 'endDate'>[],
  context: CoachingContext,
  primary: unknown,
  availableWeekdays: number[],
): (WeekTarget | null)[] | undefined {
  const block = context.controlledThreshold?.block
  if (!block || primary || context.returnToRunning) return undefined
  return blockWeekTargets(block.weekKmTargets, weeks, availableWeekdays)
}

function labelledWorkouts(draft: CoachingPlanDraft): [string, BootstrapWorkoutDraft][] {
  return draft.weeks.flatMap((week, weekIndex) => week.workouts.map((workout, workoutIndex): [string, BootstrapWorkoutDraft] =>
    [`plan.weeks[${weekIndex}].workouts[${workoutIndex}]`, workout]))
}

export function validateBootstrapDraft(draft: CoachingPlanDraft, rules: BootstrapRules): void {
  draft.weeks.forEach((week, weekIndex) => week.workouts.forEach((workout, workoutIndex) =>
    validateWorkoutDraft(workout, `plan.weeks[${weekIndex}].workouts[${workoutIndex}]`)
  ))
  validateDraftFrequency(draft, rules.runsPerWeek)
  validateDraftVolume(
    draft,
    volumeBand(rules.context.trainingHistory, rules.context.athlete.maxWeeklyKm),
    rules.availableWeekdays,
    undefined,
    rules.context.returnToRunning !== undefined,
    draftWeekTargets(draft.weeks, rules.context, rules.events.primary, rules.availableWeekdays),
  )
  validateDraftIntensity(draft, intensityBand(rules.context.athlete.thresholdPaceSecPerKm), rules.availableWeekdays)
  validateBootstrapDraftSemantics(draft, rules.events, rules.context)
  if (rules.context.returnToRunning) {
    validateReturnTargets(draft)
    validateReturnSessions(labelledWorkouts(draft), returnLimits(rules.guidance, rules.context))
  }
  if (asksNoStopSignals(rules.guidance)) validateNoStopSignals(draft)
  if (rules.events.primary === null) validateProposalsNamed(draft, rules.context)
  validateAvailableWeekdays(draft.weeks.flatMap((week) => week.workouts), rules.availableWeekdays)
  // Last: a name and a description are the cheapest things to put right, so the
  // substance is judged first and a repair is asked for it first.
  validateWorkoutDescriptions(draft, rules.context.returnToRunning !== undefined)
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
export function validateAdaptation(before: CoachingPlan, after: CoachingPlan, context: CoachingContext, options: { guideChange?: boolean; guidance?: string } = {}): void {
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
  if (asksNoStopSignals(options.guidance)) validateAdaptedStopSignals(before, after, changed)

  const draft = asDraft(after)
  const prior = asDraft(before)
  validateDraftVolume(draft, volumeBand(context.trainingHistory, context.athlete.maxWeeklyKm), weekdays, prior)
  validateDraftIntensity(draft, intensityBand(context.athlete.thresholdPaceSecPerKm), weekdays, prior, options)

  if (context.returnToRunning) {
    validateReturnSessions(changed.map((workout) => [`workout ${workout.id}`, workout]), returnLimits(options.guidance, context))
  }

  // A title the plan held keeps the rules it was written under, wherever it moved, unless its blocks changed under it.
  const titles = new Set(before.weeks.flatMap((week) => week.workouts).map((workout) => workout.title))
  for (const workout of changed) {
    const prior = previous.get(workout.id)
    const blocksChanged = prior !== undefined && JSON.stringify(prior.blocks) !== JSON.stringify(workout.blocks)
    if (prior === undefined || prior.description !== workout.description || prior.title !== workout.title) {
      validateDescriptionNotTitle(workout, `workout ${workout.id}`)
    }
    validateWorkoutName(workout, `workout ${workout.id}`, { titleAsWritten: titles.has(workout.title), blocksChanged })
  }
}
