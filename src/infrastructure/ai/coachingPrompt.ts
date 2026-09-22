import { hasCoursePacing } from '@/domain/coaching/coursePacing'
import { raceTargetFacts } from '@/domain/coaching/raceTarget'
import type { BootstrapRequest } from '@/application/ports/CoachingAdvisor'
import type { CoachingContext } from '@/application/coaching/context'
import { bootstrapRecoveryFacts } from '@/application/coaching/bootstrapValidation'
import { MAX_BOOTSTRAP_WEEKS, isoWeekWindows } from '@/domain/coaching/weekWindows'

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


export const BOOTSTRAP_SYSTEM_INSTRUCTION = 'Create a conservative running prescription for the supplied planning period. Available weekdays are scheduling opportunities, never a frequency setting. Follow runsPerWeek as the normal desired frequency, including race runs. Recovery, taper, fatigue, illness or injury may justify fewer runs; in that case week.focus must explicitly say "fewer runs" and explain the specific reason. Normal weeks target the requested number, but runsPerWeek is a preference, never a mandatory quota. Prefer fewer runs during taper when matching the count would create unnecessary consecutive running. For an explicitly targeted Saturday race, prefer Sunday easy, Tuesday easy plus strides/light sharpening, Wednesday rest, Thursday short easy shakeout, Friday rest, Saturday race; four runs including the race is a preferred taper exception when normal frequency is five. Avoid three consecutive running days within the final four days before an explicitly targeted race. Plan the aerobic volume trajectory separately from the quality-session choice. Adding one limited 5K-specific session must not automatically turn its whole week into a cutback. After immediate post-race recovery, use demonstrated sustained historical capacity to avoid unnecessary under-prescription, while recent load and adaptation still set the starting point. A non-taper build week should normally maintain or modestly increase aerobic volume versus the preceding build week; explain a decrease with specific recovery/load evidence rather than the mere presence of intervals. Supply remaining volume through easy/recovery running or easy warmup/cooldown only, never another quality workout or a faster long-run finish. Preserve race-week rest days and reduce volume through shorter easy runs, not a frequency quota. Historical capacity remains context, never a compulsory immediate target. Specify distanceMeters for aerobic running blocks where practical so weekly volume is reviewable. For timed easy recoveries, give an easy pace range when appropriate so their distance can be estimated; do not give strides an HR target. PRIMARY_TARGET is the only block target; TUNE_UP_EVENTS are independent secondary races that support it. Include every tune-up inside the planning period as a race workout on its event date, and taper or sharpen appropriately beforehand; do not place a normal tempo, threshold, VO2max, anaerobic, sprint, or long-run session within two days of a tune-up race. When POST_RACE_RECOVERY.required is true, every prescribed session through recoveryThroughDate must be easy or recovery only: no tempo, threshold, VO2max, anaerobic, sprint, race, or long run. Recent consistency, gaps, acute/chronic load, ACWR, load status, and TSB must inform how cautiously quality and volume resume; the first quality session may move into the following week. For a 10K PRIMARY_TARGET, emphasize aerobic consistency, threshold development, and long-run durability, with at most one separate faster 5K-specific/VO2 stimulus in this rolling block. When a 5K tune-up with an explicit performance target falls inside the horizon, encourage one limited controlled 5K-specific workout around 7–10 days before it if recovery and load permit: 4–5 x 800m or equivalent 3-minute repetitions at controlled current/target 5K effort, with full easy recovery, warmup and cooldown; never all-out. For this controlled session, use the supplied tune-up targetPaceSecPerKm as the fastest end of the repetition pace range when present, with a slightly slower end for control; do not substitute the generic faster VO2 training-zone range. Prefer the last available quality day 7–10 days before the tune-up, leaving the preceding available day easy or rest. Encode this session as vo2max, not easy or threshold. Strides and threshold work alone are not a meaningful 5K-specific session. If recovery/load contraindicate this session, explain the omission in week.focus. Keep the block primarily 10K-oriented, and keep any long run within three days after this stimulus entirely easy with no progression or faster finish; do not add a second quality stimulus there. When an event has courseContext, preserve targetSeconds but treat targetPace as the whole-course average, never an exact pace for every metre. For the full-distance race effort omit paceSecPerKm and use distance plus race-effort notes. Prefer supplied course/PacePro notes and splits; never invent missing splits or elevation. A slower uphill opening and faster downhill section may be correct despite the average goal pace. Keep warmup/cooldown and all other sessions unchanged when refining race pacing. Without course context, retain normal flat-race behavior. For every event, hasExplicitGoal and targetSeconds apply only to that event. Never copy a primary goal to a tune-up. When hasExplicitGoal is false, do not call any finish time an event goal; an AI-recommended pace must be described as a recommendation and encoded in paceSecPerKm. Pace and finish-time conversions are deterministic inputs: never calculate, infer, or narrate a finish time from a pace. You may repeat supplied targetFinishTime and targetPace values verbatim for that same event only. Keep plan names, plan focus, and week focus free of numeric pace or finish-time targets. Race workouts must occur on a supplied event date. Do not schedule anything outside the planning period. Use only supplied dates, athlete metrics, goals, target ranges, and available weekdays. Treat supplied hrZoneBoundsBpm as authoritative Garmin zone boundaries; do not recalculate HR zones from max HR or LTHR. Never use the words progressive or progression anywhere in an easy or steady workout title, description, workout notes, or segment notes; describe longer-term volume rebuilding as gradual instead. Workout names and descriptions must match their blocks: call a workout progressive only when multiple blocks encode an actual rise in intensity. Hill repetitions must use effort/RPE or form guidance (with HR only as secondary guidance), never a rigid flat-ground pace target; use a normal flat interval workout if pace is the execution target, and encode qualitative effort/RPE/form guidance in segment notes. If a workout includes strides, encode every intended repetition as a repeat block containing a timed strides step and a recovery step (normally 4–6 × 20 seconds when appropriate); never emit a single standalone strides block and never omit or invent the repetition count. Do not assign hrZone or hrBpm to strides because HR response lags; guide them by pace or encode effort, relaxed speed, and form in segment notes. Return structured workouts, not prose-only sessions. Do not calculate new physiological metrics.'

export function bootstrapUserPrompt(input: BootstrapRequest): string {
  const windows = isoWeekWindows(input.planningStartDate, input.horizonEndDate)
  const weekCount = windows.length
  const recovery = bootstrapRecoveryFacts(input.context, input.planningStartDate)

  return `${contextPrompt(input.context)}\nPOST_RACE_RECOVERY: ${JSON.stringify(recovery)}\nPRIMARY_TARGET: ${JSON.stringify(bootstrapEventPrompt(input.primaryTargetEvent))}\nTUNE_UP_EVENTS (each goal is independent): ${JSON.stringify(input.tuneUpEvents.map(bootstrapEventPrompt))}\nAvailable UTC weekdays (0=Sun): ${input.availableWeekdays.join(',')}\nrunsPerWeek (normal desired frequency): ${input.runsPerWeek ?? "unspecified; do not infer from availability"}\nPlan starts: ${input.planningStartDate}\nPlan horizon ends: ${input.horizonEndDate}\nReturn exactly ${weekCount} week${weekCount === 1 ? '' : 's'} using these exact startDate/endDate pairs, in this order: ${JSON.stringify(windows)}. Weeks run Monday to Sunday; the first may be shorter because the plan starts mid-week. Do not invent other boundaries, and keep every workout inside its own week.\nUser target override: ${input.targetEventId ?? 'none'}\nAdditional athlete guidance (volume ranges are guidance, not mandatory quotas): ${input.guidance ?? 'none'}`
}
