import { hasCoursePacing } from '@/domain/coaching/coursePacing'
import { raceTargetFacts } from '@/domain/coaching/raceTarget'
import type { BootstrapRequest } from '@/application/ports/CoachingAdvisor'
import type { CoachingContext } from '@/application/coaching/context'
import { bootstrapRecoveryFacts } from '@/application/coaching/bootstrapValidation'
import { MAX_BOOTSTRAP_WEEKS, isoWeekWindows } from '@/domain/coaching/weekWindows'

export { BOOTSTRAP_SYSTEM_INSTRUCTION } from './coachingRules.generated'

/**
 * What the coach asks for and the shape it must come back in, kept apart from
 * the transport that sends it. A second advisor renders the same instruction
 * and prompt into a file for a human to paste into a chat, and the two must
 * not be allowed to drift.
 */

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

const BOOTSTRAP_WORKOUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    date: { type: 'STRING' },
    type: { type: 'STRING', enum: ['easy', 'recovery', 'long_run', 'tempo', 'threshold', 'vo2max', 'anaerobic', 'sprint', 'race'] },
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    blocks: { type: 'ARRAY', items: BOOTSTRAP_BLOCK_SCHEMA },
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['date', 'type', 'title', 'description', 'blocks'],
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
}

const BOOTSTRAP_WEEK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    startDate: { type: 'STRING' },
    endDate: { type: 'STRING' },
    focus: { type: 'STRING' },
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

export function contextPrompt(context: CoachingContext): string {
  return `When currentPlan.trainingPreferences is present, preserve its runsPerWeek as normal desired frequency and availableWeekdays as scheduling opportunities. Explain exceptional frequency reductions without resetting the normal preference. Historical capacity is previously tolerated training, not a mandatory next-week mileage. Weigh trainingHistory as a whole rather than the 28-day mean alone: a month interrupted by absence rather than by fatigue, illness or injury depresses recentWeeklyAverageKm without reducing what the athlete can hold, and recent7DaysKm then says more about today than the month does. Where load, gaps and adaptation look sound, start from the most recent sustained week and rebuild toward best4WeekAverageKm rather than anchoring on the depressed mean. Do not turn recent inconsistency into a volume or frequency ceiling: an athlete who sustained around 50–55 km/week on five runs need not be capped at 30–35 km/week on four runs. Equally, a single historical peak is not a prescription, and extra weekly volume belongs in easy aerobic running, never in longer threshold repetitions.
When an activity carries a performance object, source precedence is already resolved: those figures are the race performance and garminMeasured holds the raw device reading, which must never be quoted as the race result. Structured coaching context:\n${JSON.stringify(context)}`
}

export function bootstrapEventPrompt(event: BootstrapRequest['primaryTargetEvent']): Record<string, unknown> {
  return { ...event, ...raceTargetFacts(event), ...(hasCoursePacing(event) ? { pacingMode: 'course_aware', goalPaceMeaning: 'average_over_entire_course_not_constant_pace' } : {}) }
}



export function bootstrapUserPrompt(input: BootstrapRequest): string {
  const windows = isoWeekWindows(input.planningStartDate, input.horizonEndDate)
  const weekCount = windows.length
  const recovery = bootstrapRecoveryFacts(input.context, input.planningStartDate)

  return `${contextPrompt(input.context)}\nPOST_RACE_RECOVERY: ${JSON.stringify(recovery)}\nPRIMARY_TARGET: ${JSON.stringify(bootstrapEventPrompt(input.primaryTargetEvent))}\nTUNE_UP_EVENTS (each goal is independent): ${JSON.stringify(input.tuneUpEvents.map(bootstrapEventPrompt))}\nAvailable UTC weekdays (0=Sun): ${input.availableWeekdays.join(',')}\nrunsPerWeek (normal desired frequency): ${input.runsPerWeek ?? "unspecified; do not infer from availability"}\nPlan starts: ${input.planningStartDate}\nPlan horizon ends: ${input.horizonEndDate}\nReturn exactly ${weekCount} week${weekCount === 1 ? '' : 's'} using these exact startDate/endDate pairs, in this order: ${JSON.stringify(windows)}. Weeks run Monday to Sunday; the first may be shorter because the plan starts mid-week. Do not invent other boundaries, and keep every workout inside its own week.\nUser target override: ${input.targetEventId ?? 'none'}\nAdditional athlete guidance (volume ranges are guidance, not mandatory quotas): ${input.guidance ?? 'none'}`
}
