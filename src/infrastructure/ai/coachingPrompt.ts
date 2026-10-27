import { DAY_MS } from '@/lib/calendarDate'
import { hasCoursePacing } from '@/domain/coaching/coursePacing'
import { raceTargetFacts } from '@/domain/coaching/raceTarget'
import {
  WEEK_REDUCTION_REASONS,
  type ActivityEvaluationRequest,
  type BootstrapRequest,
  type WeeklyReviewRequest,
} from '@/application/ports/CoachingAdvisor'
import type { CoachingContext } from '@/application/coaching/context'
import type { Activity } from '@/domain/activity/types'
import { garminMeasured } from '@/domain/activity/raceResult'
import { bootstrapRecoveryFacts } from '@/application/coaching/bootstrapValidation'
import { MAX_BOOTSTRAP_WEEKS, isoWeekWindows, type WeekWindow } from '@/domain/coaching/weekWindows'
import { macrocyclePhases, phaseOn } from '@/domain/coaching/macrocycle'
import { CONTROLLED_THRESHOLD } from '@/application/coaching/controlledThreshold'
import { draftWeekTargets } from '@/application/coaching/draftRules'

import {
  ADAPTATION_READING_INSTRUCTION,
  BOOTSTRAP_SYSTEM_INSTRUCTION as BOOTSTRAP_RULES,
  WORKOUT_NAMING_INSTRUCTION,
} from './coachingRules.generated'
import { activeLocale } from '@/i18n'

/**
 * The athlete's text follows the locale; the JSON stays English, its keys and enums read by code.
 * The French wording for "fewer runs" and its reasons must stay one validateDraftFrequency accepts.
 */
export const COACHING_LANGUAGE_RULE = activeLocale === 'fr'
  ? 'Write every text the athlete reads in French, tutoiement, as a French-speaking running coach would say it: the plan name and focus, every week.focus and reducedVolume explanation, every workout title, shortName, description, notes and structure extras, every segment note, and the summary and evidence messages of a decision. ' +
    'Use the words French runners use (footing, sortie longue, endurance fondamentale, seuil, fractionné, accélérations, échauffement, retour au calme, récup) and French names of the same shape: « Seuil · 3 × 8′ @ 4:25 », « Footing · 6 accélérations », « Sortie longue », « Footing de récupération », with short names such as « Seuil 3×8′ » or « Footing + accél. ». ' +
    "You are not told the athlete's gender, so no adjective or past participle may agree with the athlete. " +
    'Keep every JSON key, enum value, id and date exactly as specified, in English. ' +
    'Where these rules ask week.focus to say "fewer runs" with a recovery, taper, fatigue, illness or injury reason, write « moins de sorties » with « récupération », « affûtage », « fatigue », « maladie » or « blessure ».'
  : ''

export function withCoachingLanguage(instruction: string): string {
  return COACHING_LANGUAGE_RULE ? `${instruction} ${COACHING_LANGUAGE_RULE}` : instruction
}

export const BOOTSTRAP_SYSTEM_INSTRUCTION = withCoachingLanguage(BOOTSTRAP_RULES)

export const ADAPTATION_NAMING_RULE = `Name every workout you add or rewrite by these rules, and keep the title of one you leave unchanged: ${WORKOUT_NAMING_INSTRUCTION}`

/** Shared by the Gemini and the manual advisor, so the prompt the two send cannot drift apart. */

const RANGE_SCHEMA = {
  type: 'OBJECT',
  properties: { min: { type: 'NUMBER' }, max: { type: 'NUMBER' } },
  required: ['min', 'max'],
}

const TARGET_SCHEMA = {
  type: 'OBJECT',
  properties: {
    durationSeconds: { type: 'INTEGER' },
    distanceMeters: { type: 'INTEGER' },
    paceSecPerKm: RANGE_SCHEMA,
    hrBpm: RANGE_SCHEMA,
    hrZone: { type: 'INTEGER' },
  },
}

const SEGMENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: { type: 'STRING', enum: ['warmup', 'effort', 'recovery', 'cooldown', 'strides'] },
    target: TARGET_SCHEMA,
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['kind', 'target'],
}

const BLOCK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: { type: 'STRING', enum: ['warmup', 'effort', 'recovery', 'cooldown', 'strides', 'repeat'] },
    target: TARGET_SCHEMA,
    repetitions: { type: 'INTEGER' },
    steps: { type: 'ARRAY', items: SEGMENT_SCHEMA },
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['kind'],
}

const BOOTSTRAP_BLOCK_SCHEMA = {
  ...BLOCK_SCHEMA,
  properties: {
    ...BLOCK_SCHEMA.properties,
    kind: { type: 'STRING', enum: ['warmup', 'effort', 'recovery', 'cooldown', 'repeat'] },
  },
}

// Optional, so a plan written before name structures still reads.
const NAME_STRUCTURE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reps: { type: 'INTEGER' },
    repMinutes: { type: 'NUMBER' },
    targetPace: { type: 'STRING' },
    extras: { type: 'ARRAY', items: { type: 'STRING' } },
  },
}

const BOOTSTRAP_WORKOUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    date: { type: 'STRING' },
    type: { type: 'STRING', enum: ['easy', 'recovery', 'long_run', 'tempo', 'threshold', 'vo2max', 'anaerobic', 'sprint', 'race'] },
    title: { type: 'STRING' },
    shortName: { type: 'STRING' },
    structure: NAME_STRUCTURE_SCHEMA,
    description: { type: 'STRING' },
    blocks: { type: 'ARRAY', items: BOOTSTRAP_BLOCK_SCHEMA },
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  // A new block is named under the naming rules, so every session has a short name.
  required: ['date', 'type', 'title', 'shortName', 'description', 'blocks'],
}

export const ADAPTATION_WORKOUT_SCHEMA = {
  ...BOOTSTRAP_WORKOUT_SCHEMA,
  properties: {
    ...BOOTSTRAP_WORKOUT_SCHEMA.properties,
    id: { type: 'STRING' },
    totalDurationSeconds: { type: 'INTEGER' },
    totalDistanceMeters: { type: 'INTEGER' },
    blocks: { type: 'ARRAY', items: BLOCK_SCHEMA },
  },
  // A session a change carries over keeps its name, which may predate short names.
  required: ['date', 'type', 'title', 'description', 'blocks'],
}

const WEEK_REDUCTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reason: { type: 'STRING', enum: [...WEEK_REDUCTION_REASONS] },
    explanation: { type: 'STRING' },
  },
  required: ['reason', 'explanation'],
}

const BOOTSTRAP_WEEK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    startDate: { type: 'STRING' },
    endDate: { type: 'STRING' },
    focus: { type: 'STRING' },
    reducedVolume: WEEK_REDUCTION_SCHEMA,
    workouts: { type: 'ARRAY', items: BOOTSTRAP_WORKOUT_SCHEMA },
  },
  required: ['startDate', 'endDate', 'focus', 'workouts'],
}

export const ADAPTATION_WEEK_SCHEMA = {
  ...BOOTSTRAP_WEEK_SCHEMA,
  properties: {
    ...BOOTSTRAP_WEEK_SCHEMA.properties,
    id: { type: 'STRING' },
    workouts: { type: 'ARRAY', items: ADAPTATION_WORKOUT_SCHEMA },
  },
}

export const BOOTSTRAP_PLAN_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    focus: { type: 'STRING' },
    weeks: { type: 'ARRAY', items: BOOTSTRAP_WEEK_SCHEMA, minItems: 1, maxItems: MAX_BOOTSTRAP_WEEKS },
  },
  required: ['name', 'focus', 'weeks'],
}

/** Only with sessions to read, so the prompt of an athlete who does none stays as it was. */
const OTHER_TRAINING_RULE = ' otherTraining lists the non-running sessions (strength, cycling, swimming…) of the last 28 days: they are in none of the running volume, load or gap figures. Read them as fatigue on the days they fall and as the athlete\'s own injury-prevention work, never as running volume.'

const REBUILD_VOLUME = 'Where load, gaps and adaptation look sound, start from the most recent sustained week and rebuild toward best4WeekAverageKm rather than anchoring on the depressed mean. Do not turn recent inconsistency into a volume or frequency ceiling: an athlete who sustained around 50–55 km/week on five runs need not be capped at 30–35 km/week on four runs.'

const RETURNING_VOLUME = 'context.returnToRunning is present, so the athlete is returning to running: best4WeekAverageKm and every figure from before the break describe the past, not a target, and the return-to-running rules set where volume starts and how it grows.'

export function contextPrompt(context: CoachingContext): string {
  return `When currentPlan.trainingPreferences is present, preserve its runsPerWeek as normal desired frequency and availableWeekdays as scheduling opportunities. Explain exceptional frequency reductions without resetting the normal preference. Historical capacity is previously tolerated training, not a mandatory next-week mileage. Weigh trainingHistory as a whole rather than the 28-day mean alone: a month interrupted by absence rather than by fatigue, illness or injury depresses recentWeeklyAverageKm without reducing what the athlete can hold, and recent7DaysKm then says more about today than the month does. ${context.returnToRunning ? RETURNING_VOLUME : REBUILD_VOLUME} Equally, a single historical peak is not a prescription, and extra weekly volume belongs in easy aerobic running, never in longer threshold repetitions.
When an activity carries a performance object, source precedence is already resolved: those figures are the race performance and garminMeasured holds the raw device reading, which must never be quoted as the race result.${context.otherTraining ? OTHER_TRAINING_RULE : ''} Structured coaching context:\n${JSON.stringify(context)}`
}


export function bootstrapEventPrompt(event: BootstrapRequest['tuneUpEvents'][number]): Record<string, unknown> {
  return { ...event, ...raceTargetFacts(event), ...(hasCoursePacing(event) ? { pacingMode: 'course_aware', goalPaceMeaning: 'average_over_entire_course_not_constant_pace' } : {}) }
}



function macrocyclePrompt(input: BootstrapRequest, windows: { startDate: string; endDate: string }[]): string {
  const start = input.macrocycleStartDate
  if (!input.primaryTargetEvent) {
    // No race, so no phases: the block is told the weeks since general preparation
    // began, counted in Monday weeks so a Thursday start and the Monday after are not both week 1.
    const monday = (date: string) => {
      const time = Date.parse(`${date}T00:00:00Z`)
      return time - ((new Date(time).getUTCDay() + 6) % 7) * DAY_MS
    }
    const weekOf = (date: string) => Math.round((monday(date) - monday(start)) / (7 * DAY_MS)) + 1
    return JSON.stringify({
      mode: 'general_preparation',
      startDate: start,
      weeksInThisBlock: windows.map((window) => ({ ...window, phase: 'general', weekOfPreparation: weekOf(window.startDate) })),
    })
  }
  const phases = macrocyclePhases(start, input.primaryTargetEvent.date)
  if (phases.length === 0) return 'unknown; treat this block on its own terms'
  return JSON.stringify({
    startDate: start,
    raceDate: input.primaryTargetEvent.date,
    phases,
    weeksInThisBlock: windows.map((window) => ({ ...window, phase: phaseOn(phases, window.startDate) })),
  })
}

function blockWeeksPrompt(input: BootstrapRequest, windows: WeekWindow[]): string {
  const targets = draftWeekTargets(windows, input.context, input.primaryTargetEvent, input.availableWeekdays)
  if (!targets) return ''
  const weeks = windows.map((window, index) => ({ ...window, targetKm: targets[index]?.km ?? 0, lighter: targets[index]?.lighter ?? false }))
  return `\nCONTROLLED_THRESHOLD_BLOCK_WEEKS (each week's km within ${CONTROLLED_THRESHOLD.block.targetToleranceKm} km of its target): ${JSON.stringify(weeks)}`
}

export function bootstrapUserPrompt(input: BootstrapRequest): string {
  const windows = isoWeekWindows(input.planningStartDate, input.horizonEndDate)
  const weekCount = windows.length
  // Without the season's phases, a rolling block cannot tell a base block from a peak one.
  const primary = input.primaryTargetEvent
  const recovery = bootstrapRecoveryFacts(input.context, input.planningStartDate)
  const target = primary
    ? JSON.stringify(bootstrapEventPrompt(primary))
    : 'none - general preparation, progressing fitness over time rather than toward a race'

  return `${contextPrompt(input.context)}\nPOST_RACE_RECOVERY: ${JSON.stringify(recovery)}\nPRIMARY_TARGET: ${target}\nTUNE_UP_EVENTS (each goal is independent): ${JSON.stringify(input.tuneUpEvents.map(bootstrapEventPrompt))}\nAvailable UTC weekdays (0=Sun): ${input.availableWeekdays.join(',')}\nrunsPerWeek (normal desired frequency): ${input.runsPerWeek ?? "unspecified; do not infer from availability"}\nMACROCYCLE (the season this rolling block is one slice of): ${macrocyclePrompt(input, windows)}\nCONTROLLED_THRESHOLD_DOSE: ${JSON.stringify(CONTROLLED_THRESHOLD.dose)}${blockWeeksPrompt(input, windows)}\nPlan starts: ${input.planningStartDate}${input.planningStartDate > input.context.referenceDate && input.context.currentPlan ? ` (sessions from ${input.context.referenceDate} until then stay as currentPlan has them)` : ''}\nPlan horizon ends: ${input.horizonEndDate}\nReturn exactly ${weekCount} week${weekCount === 1 ? '' : 's'} using these exact startDate/endDate pairs, in this order: ${JSON.stringify(windows)}. Weeks run Monday to Sunday; the first may be shorter because the plan starts mid-week. Do not invent other boundaries, and keep every workout inside its own week.\nUser target override: ${input.targetEventId ?? 'none'}\nAdditional athlete guidance (volume ranges are guidance, not mandatory quotas): ${input.guidance ?? 'none'}`
}

const EVIDENCE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    code: { type: 'STRING' },
    message: { type: 'STRING' },
    value: { type: 'STRING' },
    unit: { type: 'STRING' },
  },
  required: ['code', 'message'],
}

const CHANGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: { type: 'STRING', enum: ['upsert_workout', 'cancel_workout', 'replace_future'] },
    workoutId: { type: 'STRING' },
    workout: ADAPTATION_WORKOUT_SCHEMA,
    effectiveDate: { type: 'STRING' },
    weeks: { type: 'ARRAY', items: ADAPTATION_WEEK_SCHEMA },
  },
  required: ['kind'],
}

export const RECOMMENDATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    outcome: { type: 'STRING', enum: ['KEEP', 'ADJUST', 'REPLAN'] },
    reasonCodes: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 1 },
    summary: { type: 'STRING' },
    evidence: { type: 'ARRAY', items: EVIDENCE_SCHEMA },
    changes: { type: 'ARRAY', items: CHANGE_SCHEMA },
  },
  required: ['outcome', 'reasonCodes', 'summary', 'evidence', 'changes'],
}

export interface CoachingPromptParts {
  systemInstruction: string
  userPrompt: string
  schema: Record<string, unknown>
}

export function completedActivityPrompt(context: CoachingContext, activity: Activity): Record<string, unknown> {
  const compact = context.recentActivities.find((entry) => entry.id === activity.id)
  const raceExecution = compact?.raceExecution ? { raceExecution: compact.raceExecution } : {}

  if (compact?.performance?.source === 'official') {
    return {
      id: activity.id,
      date: activity.date,
      type: activity.type,
      performance: compact.performance,
      garminMeasured: compact.garminMeasured ?? garminMeasured(activity),
      ...raceExecution,
      avgHeartRate: activity.avgHeartRate,
      rpe: activity.rpe,
    }
  }

  return {
    id: activity.id,
    date: activity.date,
    type: activity.type,
    ...(compact?.intendedType ? { intendedType: compact.intendedType } : {}),
    distanceKm: activity.distanceKm,
    durationSeconds: activity.durationSeconds,
    paceSecPerKm: activity.paceSecPerKm,
    ...raceExecution,
    avgHeartRate: activity.avgHeartRate,
    rpe: activity.rpe,
  }
}

/** The plan's own week windows, so a REPLAN lands on weeks the block already has and never past its end. */
export function remainingWeekWindows(context: CoachingContext, effectiveDate: string): WeekWindow[] {
  const block = context.currentPlan?.block
  if (!block) return []
  return isoWeekWindows(block.startDate, block.endDate).filter((window) => window.endDate >= effectiveDate)
}

const ADAPTATION_RULES = `Never alter completed or past sessions. ${ADAPTATION_NAMING_RULE} ${ADAPTATION_READING_INSTRUCTION}`

function adaptationHorizon(context: CoachingContext, effectiveDate: string): string {
  const windows = remainingWeekWindows(context, effectiveDate)
  const from = `\nChanges take effect from: ${effectiveDate}; every session you add, move or rewrite falls on or after it.`
  if (windows.length === 0) return `${from}\nThe block has no week left, so answer KEEP: a new block is planned separately.`
  return `${from}\nThe block ends ${context.currentPlan!.block.endDate}. A REPLAN's replace_future starts at ${effectiveDate} and returns exactly these weeks, using these exact startDate/endDate pairs, in this order: ${JSON.stringify(windows)}. Never add a week past the block's end, and keep every workout inside its own week.`
}

/** A change to the live plan is held to the guidance too, so it has to be told it. */
function guidancePrompt(guidance: string | undefined): string {
  return guidance ? `\nAdditional athlete guidance: ${guidance}` : ''
}

export function activityEvaluationPrompt(input: ActivityEvaluationRequest): CoachingPromptParts {
  return {
    systemInstruction: withCoachingLanguage(`Evaluate the completed run and choose KEEP, ADJUST, or REPLAN. Normal runs should usually be KEEP. Use ADJUST only for small future workout changes and REPLAN only for meaningful events. Reasons and evidence must cite supplied facts. ${ADAPTATION_RULES}`),
    userPrompt: `${contextPrompt(input.context)}\nCompleted activity: ${JSON.stringify(completedActivityPrompt(input.context, input.activity))}\nMatched prescription: ${JSON.stringify(input.prescription)}${adaptationHorizon(input.context, input.effectiveDate)}${guidancePrompt(input.guidance)}`,
    schema: RECOMMENDATION_SCHEMA,
  }
}

export function weeklyReviewPrompt(input: WeeklyReviewRequest): CoachingPromptParts {
  return {
    systemInstruction: withCoachingLanguage(`Review the rolling running plan. Prefer KEEP when the current future prescription remains appropriate, ADJUST for small workout changes, and REPLAN only for a material change. ${ADAPTATION_RULES}`),
    userPrompt: `${contextPrompt(input.context)}${adaptationHorizon(input.context, input.effectiveDate)}${guidancePrompt(input.guidance)}`,
    schema: RECOMMENDATION_SCHEMA,
  }
}

export function bootstrapPrompt(input: BootstrapRequest): CoachingPromptParts {
  return { systemInstruction: BOOTSTRAP_SYSTEM_INSTRUCTION, userPrompt: bootstrapUserPrompt(input), schema: BOOTSTRAP_PLAN_RESPONSE_SCHEMA }
}
