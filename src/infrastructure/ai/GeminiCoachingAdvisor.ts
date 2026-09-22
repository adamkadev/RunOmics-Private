import { hasCoursePacing } from '@/domain/coaching/coursePacing'
import type { Activity } from '@/domain/activity/types'
import {
  COACHING_SCHEMA_VERSION,
  type CoachEvidence,
  type TrainingWeek,
  type WorkoutPrescription,
  type WorkoutRepeatBlock,
  type WorkoutSegment,
} from '@/domain/coaching/types'
import { raceTargetFacts } from '@/domain/coaching/raceTarget'
import { parseCoachingPlan, parseWorkoutPrescription } from '@/domain/coaching/validation'
import type {
  AdvisorPlanChange,
  AdvisorRecommendation,
  BootstrapWorkoutDraft,
  BootstrapRequest,
  CoachingAdvisor,
  CoachingPlanDraft,
} from '@/application/ports/CoachingAdvisor'
import type { CoachingContext } from '@/application/coaching/context'
import { garminMeasured } from '@/domain/activity/raceResult'
import { bootstrapRecoveryFacts } from '@/application/coaching/bootstrapValidation'
import { MODEL_POOL } from '@/domain/ai/budget'
import { MAX_BOOTSTRAP_WEEKS, isoWeekWindows } from '@/domain/coaching/weekWindows'
import { generateStructuredJson } from '@/lib/gemini'

/**
 * An explicit choice is the only choice; otherwise the whole pool is available,
 * because a 503 is Google declining this model right now rather than a verdict
 * on the request, and the next model in the pool usually answers.
 */
const MODELS = (): string[] => {
  const chosen = process.env.GEMINI_COACH_MODEL || process.env.GEMINI_MODEL
  return chosen ? [chosen] : [...MODEL_POOL]
}
const API_KEY = () => process.env.GEMINI_COACH_API_KEY
const PLACEHOLDER_TIME = '2000-01-01T00:00:00.000Z'
const PLACEHOLDER_PROVENANCE = { source: 'gemini' as const, trigger: 'bootstrap' as const, createdAt: PLACEHOLDER_TIME }

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

const ADAPTATION_WORKOUT_SCHEMA = {
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

const ADAPTATION_WEEK_SCHEMA = {
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

const RECOMMENDATION_SCHEMA = {
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

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function date(value: unknown, label: string): string {
  const result = text(value, label)
  const parsed = new Date(`${result}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date`)
  }
  return result
}

function flattenedSegments(blocks: WorkoutPrescription['blocks']): WorkoutSegment[] {
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

function bootstrapWorkoutDraft(value: unknown, label: string): BootstrapWorkoutDraft {
  const raw = record(value, label)
  const parsed = parseWorkoutPrescription({
    id: 'structural-draft',
    revision: 1,
    date: raw.date,
    type: raw.type,
    title: raw.title,
    description: raw.description,
    status: 'prescribed',
    blocks: raw.blocks,
    ...(raw.notes === undefined ? {} : { notes: raw.notes }),
    provenance: PLACEHOLDER_PROVENANCE,
  }, label)
  const mentionsStrides = /\bstrides?\b/i.test([
    parsed.title,
    parsed.description,
    ...(parsed.notes ?? []),
  ].join('\n'))
  const strideRepeats = parsed.blocks.filter((block): block is WorkoutRepeatBlock =>
    block.kind === 'repeat' && block.steps.some((step) => step.kind === 'strides')
  )
  const segments = flattenedSegments(parsed.blocks)
  const hasStandaloneStrides = parsed.blocks.some((block) => block.kind === 'strides')
  if (hasStandaloneStrides) {
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
    parsed.title,
    parsed.description,
    ...(parsed.notes ?? []),
    ...segments.flatMap((segment) => segment.notes ?? []),
  ].join('\n')
  const isHillWorkout = parsed.type !== 'race'
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
  return {
    date: parsed.date,
    type: parsed.type,
    title: parsed.title,
    description: parsed.description,
    blocks: parsed.blocks,
    ...(parsed.notes ? { notes: parsed.notes } : {}),
  }
}

export function parseBootstrapPlanDraft(value: unknown): CoachingPlanDraft {
  const raw = record(value, 'plan')
  const weeks = list(raw.weeks, 'plan.weeks').map((value, index) => {
    const label = `plan.weeks[${index}]`
    const week = record(value, label)
    const startDate = date(week.startDate, `${label}.startDate`)
    const endDate = date(week.endDate, `${label}.endDate`)
    if (startDate > endDate) throw new Error(`${label}: startDate must be <= endDate`)
    const workouts = list(week.workouts, `${label}.workouts`).map((workout, workoutIndex) =>
      bootstrapWorkoutDraft(workout, `${label}.workouts[${workoutIndex}]`)
    )
    for (const workout of workouts) {
      if (workout.date < startDate || workout.date > endDate) throw new Error(`${label}: workout ${workout.date} falls outside its week`)
    }
    return { startDate, endDate, focus: text(week.focus, `${label}.focus`), workouts }
  })
  if (weeks.length === 0 || weeks.length > MAX_BOOTSTRAP_WEEKS) throw new Error(`plan.weeks must contain 1 to ${MAX_BOOTSTRAP_WEEKS} weeks`)
  return { name: text(raw.name, 'plan.name'), focus: text(raw.focus, 'plan.focus'), weeks }
}

function draftWorkout(value: unknown, trigger: 'bootstrap' | 'post_activity' | 'weekly_review'): WorkoutPrescription {
  const raw = record(value, 'workout')
  return parseWorkoutPrescription({
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : 'draft-workout',
    revision: 1,
    status: 'prescribed',
    provenance: { ...PLACEHOLDER_PROVENANCE, trigger },
  })
}

function draftWeeks(value: unknown, trigger: 'bootstrap' | 'weekly_review' | 'post_activity'): TrainingWeek[] {
  const rawWeeks = list(value, 'weeks').map((value, index) => {
    const week = record(value, `weeks[${index}]`)
    return {
      ...week,
      id: typeof week.id === 'string' && week.id ? week.id : `draft-week-${index + 1}`,
      index: index + 1,
      workouts: list(week.workouts, `weeks[${index}].workouts`).map((workout) => draftWorkout(workout, trigger)),
    }
  })
  const first = rawWeeks[0] as { startDate?: unknown } | undefined
  const last = rawWeeks[rawWeeks.length - 1] as { endDate?: unknown } | undefined
  return parseCoachingPlan({
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: 'draft-plan',
    revision: 1,
    status: 'active',
    block: {
      id: 'draft-block',
      name: 'Draft block',
      startDate: text(first?.startDate, 'first week startDate'),
      endDate: text(last?.endDate, 'last week endDate'),
      focus: 'Draft focus',
    },
    targetEvent: { id: 'draft-event', name: 'Draft event', date: '2099-01-01' },
    goal: { kind: 'finish', description: 'Draft goal' },
    weeks: rawWeeks,
    provenance: { ...PLACEHOLDER_PROVENANCE, trigger },
  }).weeks
}

function parseEvidence(value: unknown): CoachEvidence {
  const raw = record(value, 'evidence')
  const rawValue = raw.value
  return {
    code: text(raw.code, 'evidence.code'),
    message: text(raw.message, 'evidence.message'),
    ...(typeof rawValue === 'string' || typeof rawValue === 'number' ? { value: rawValue } : {}),
    ...(typeof raw.unit === 'string' && raw.unit ? { unit: raw.unit } : {}),
  }
}

function parseRecommendation(value: unknown, trigger: 'post_activity' | 'weekly_review'): AdvisorRecommendation {
  const raw = record(value, 'recommendation')
  const outcome = text(raw.outcome, 'recommendation.outcome')
  if (outcome !== 'KEEP' && outcome !== 'ADJUST' && outcome !== 'REPLAN') throw new Error(`Unsupported outcome ${outcome}`)
  const changes = list(raw.changes, 'recommendation.changes').map((value): AdvisorPlanChange => {
    const change = record(value, 'change')
    const kind = text(change.kind, 'change.kind')
    if (kind === 'cancel_workout') return { kind, workoutId: text(change.workoutId, 'change.workoutId') }
    if (kind === 'upsert_workout') {
      return {
        kind,
        ...(typeof change.workoutId === 'string' && change.workoutId ? { workoutId: change.workoutId } : {}),
        workout: draftWorkout(change.workout, trigger),
      }
    }
    if (kind === 'replace_future') {
      return { kind, effectiveDate: text(change.effectiveDate, 'change.effectiveDate'), weeks: draftWeeks(change.weeks, trigger) }
    }
    throw new Error(`Unsupported change kind ${kind}`)
  })
  return {
    outcome,
    reasonCodes: list(raw.reasonCodes, 'recommendation.reasonCodes').map((item) => text(item, 'reason code')),
    summary: text(raw.summary, 'recommendation.summary'),
    evidence: list(raw.evidence, 'recommendation.evidence').map(parseEvidence),
    changes,
  }
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
    distanceKm: activity.distanceKm,
    durationSeconds: activity.durationSeconds,
    paceSecPerKm: activity.paceSecPerKm,
    ...raceExecution,
    avgHeartRate: activity.avgHeartRate,
    rpe: activity.rpe,
  }
}

function contextPrompt(context: CoachingContext): string {
  return `When currentPlan.trainingPreferences is present, preserve its runsPerWeek as normal desired frequency and availableWeekdays as scheduling opportunities. Explain exceptional frequency reductions without resetting the normal preference. Historical capacity is previously tolerated training, NOT a safe immediate target or mandatory next-week mileage. Recent volume, frequency, gaps and load determine the starting point. Rebuild progressively toward demonstrated sustained capacity only if recovery and adaptation are good. Do not turn recent inconsistency into a permanent volume or frequency ceiling: an athlete who sustained around 50–55 km/week on five runs need not be capped at 30–35 km/week on four runs. Historical peaks are not immediate prescriptions.
When an activity carries a performance object, source precedence is already resolved: those figures are the race performance and garminMeasured holds the raw device reading, which must never be quoted as the race result. Structured coaching context:\n${JSON.stringify(context)}`
}

export function bootstrapEventPrompt(event: BootstrapRequest['primaryTargetEvent']): Record<string, unknown> {
  return { ...event, ...raceTargetFacts(event), ...(hasCoursePacing(event) ? { pacingMode: 'course_aware', goalPaceMeaning: 'average_over_entire_course_not_constant_pace' } : {}) }
}

async function request(schema: Record<string, unknown>, systemInstruction: string, prompt: string): Promise<unknown> {
  const apiKey = API_KEY()
  if (!apiKey) throw new Error('Gemini coaching request failed: GEMINI_COACH_API_KEY is not configured')

  const models = MODELS()
  const reasons: string[] = []

  for (const model of models) {
    const result = await generateStructuredJson({ apiKey, model, systemInstruction, prompt, responseSchema: schema, temperature: 0.2 })
    if (result.ok) return result.value
    reasons.push(`${model}: ${result.reason}`)
  }

  throw new Error(`Gemini coaching request failed: ${reasons.join(' | ')}`)
}

export class GeminiCoachingAdvisor implements CoachingAdvisor {
  async bootstrap(input: BootstrapRequest): Promise<CoachingPlanDraft> {
    const windows = isoWeekWindows(input.planningStartDate, input.horizonEndDate)
    const weekCount = windows.length
    const recovery = bootstrapRecoveryFacts(input.context, input.planningStartDate)
    const raw = await request(
      BOOTSTRAP_PLAN_RESPONSE_SCHEMA,
      'Create a conservative running prescription for the supplied planning period. Available weekdays are scheduling opportunities, never a frequency setting. Follow runsPerWeek as the normal desired frequency, including race runs. Recovery, taper, fatigue, illness or injury may justify fewer runs; in that case week.focus must explicitly say "fewer runs" and explain the specific reason. Normal weeks target the requested number, but runsPerWeek is a preference, never a mandatory quota. Prefer fewer runs during taper when matching the count would create unnecessary consecutive running. For an explicitly targeted Saturday race, prefer Sunday easy, Tuesday easy plus strides/light sharpening, Wednesday rest, Thursday short easy shakeout, Friday rest, Saturday race; four runs including the race is a preferred taper exception when normal frequency is five. Avoid three consecutive running days within the final four days before an explicitly targeted race. Plan the aerobic volume trajectory separately from the quality-session choice. Adding one limited 5K-specific session must not automatically turn its whole week into a cutback. After immediate post-race recovery, use demonstrated sustained historical capacity to avoid unnecessary under-prescription, while recent load and adaptation still set the starting point. A non-taper build week should normally maintain or modestly increase aerobic volume versus the preceding build week; explain a decrease with specific recovery/load evidence rather than the mere presence of intervals. Supply remaining volume through easy/recovery running or easy warmup/cooldown only, never another quality workout or a faster long-run finish. Preserve race-week rest days and reduce volume through shorter easy runs, not a frequency quota. Historical capacity remains context, never a compulsory immediate target. Specify distanceMeters for aerobic running blocks where practical so weekly volume is reviewable. For timed easy recoveries, give an easy pace range when appropriate so their distance can be estimated; do not give strides an HR target. PRIMARY_TARGET is the only block target; TUNE_UP_EVENTS are independent secondary races that support it. Include every tune-up inside the planning period as a race workout on its event date, and taper or sharpen appropriately beforehand; do not place a normal tempo, threshold, VO2max, anaerobic, sprint, or long-run session within two days of a tune-up race. When POST_RACE_RECOVERY.required is true, every prescribed session through recoveryThroughDate must be easy or recovery only: no tempo, threshold, VO2max, anaerobic, sprint, race, or long run. Recent consistency, gaps, acute/chronic load, ACWR, load status, and TSB must inform how cautiously quality and volume resume; the first quality session may move into the following week. For a 10K PRIMARY_TARGET, emphasize aerobic consistency, threshold development, and long-run durability, with at most one separate faster 5K-specific/VO2 stimulus in this rolling block. When a 5K tune-up with an explicit performance target falls inside the horizon, encourage one limited controlled 5K-specific workout around 7–10 days before it if recovery and load permit: 4–5 x 800m or equivalent 3-minute repetitions at controlled current/target 5K effort, with full easy recovery, warmup and cooldown; never all-out. For this controlled session, use the supplied tune-up targetPaceSecPerKm as the fastest end of the repetition pace range when present, with a slightly slower end for control; do not substitute the generic faster VO2 training-zone range. Prefer the last available quality day 7–10 days before the tune-up, leaving the preceding available day easy or rest. Encode this session as vo2max, not easy or threshold. Strides and threshold work alone are not a meaningful 5K-specific session. If recovery/load contraindicate this session, explain the omission in week.focus. Keep the block primarily 10K-oriented, and keep any long run within three days after this stimulus entirely easy with no progression or faster finish; do not add a second quality stimulus there. When an event has courseContext, preserve targetSeconds but treat targetPace as the whole-course average, never an exact pace for every metre. For the full-distance race effort omit paceSecPerKm and use distance plus race-effort notes. Prefer supplied course/PacePro notes and splits; never invent missing splits or elevation. A slower uphill opening and faster downhill section may be correct despite the average goal pace. Keep warmup/cooldown and all other sessions unchanged when refining race pacing. Without course context, retain normal flat-race behavior. For every event, hasExplicitGoal and targetSeconds apply only to that event. Never copy a primary goal to a tune-up. When hasExplicitGoal is false, do not call any finish time an event goal; an AI-recommended pace must be described as a recommendation and encoded in paceSecPerKm. Pace and finish-time conversions are deterministic inputs: never calculate, infer, or narrate a finish time from a pace. You may repeat supplied targetFinishTime and targetPace values verbatim for that same event only. Keep plan names, plan focus, and week focus free of numeric pace or finish-time targets. Race workouts must occur on a supplied event date. Do not schedule anything outside the planning period. Use only supplied dates, athlete metrics, goals, target ranges, and available weekdays. Treat supplied hrZoneBoundsBpm as authoritative Garmin zone boundaries; do not recalculate HR zones from max HR or LTHR. Never use the words progressive or progression anywhere in an easy or steady workout title, description, workout notes, or segment notes; describe longer-term volume rebuilding as gradual instead. Workout names and descriptions must match their blocks: call a workout progressive only when multiple blocks encode an actual rise in intensity. Hill repetitions must use effort/RPE or form guidance (with HR only as secondary guidance), never a rigid flat-ground pace target; use a normal flat interval workout if pace is the execution target, and encode qualitative effort/RPE/form guidance in segment notes. If a workout includes strides, encode every intended repetition as a repeat block containing a timed strides step and a recovery step (normally 4–6 × 20 seconds when appropriate); never emit a single standalone strides block and never omit or invent the repetition count. Do not assign hrZone or hrBpm to strides because HR response lags; guide them by pace or encode effort, relaxed speed, and form in segment notes. Return structured workouts, not prose-only sessions. Do not calculate new physiological metrics.',
      `${contextPrompt(input.context)}\nPOST_RACE_RECOVERY: ${JSON.stringify(recovery)}\nPRIMARY_TARGET: ${JSON.stringify(bootstrapEventPrompt(input.primaryTargetEvent))}\nTUNE_UP_EVENTS (each goal is independent): ${JSON.stringify(input.tuneUpEvents.map(bootstrapEventPrompt))}\nAvailable UTC weekdays (0=Sun): ${input.availableWeekdays.join(',')}\nrunsPerWeek (normal desired frequency): ${input.runsPerWeek ?? "unspecified; do not infer from availability"}\nPlan starts: ${input.planningStartDate}\nPlan horizon ends: ${input.horizonEndDate}\nReturn exactly ${weekCount} week${weekCount === 1 ? '' : 's'} using these exact startDate/endDate pairs, in this order: ${JSON.stringify(windows)}. Weeks run Monday to Sunday; the first may be shorter because the plan starts mid-week. Do not invent other boundaries, and keep every workout inside its own week.\nUser target override: ${input.targetEventId ?? 'none'}\nAdditional athlete guidance (volume ranges are guidance, not mandatory quotas): ${input.guidance ?? 'none'}`,
    )
    return parseBootstrapPlanDraft(raw)
  }

  async evaluateActivity(input: { context: CoachingContext; activity: Activity; prescription: WorkoutPrescription | null }): Promise<AdvisorRecommendation> {
    const raw = await request(
      RECOMMENDATION_SCHEMA,
      'Evaluate the completed run and choose KEEP, ADJUST, or REPLAN. Normal runs should usually be KEEP. Use ADJUST only for small future workout changes and REPLAN only for meaningful events. Never alter completed or past sessions. Reasons and evidence must cite supplied facts.',
      `${contextPrompt(input.context)}\nCompleted activity: ${JSON.stringify(completedActivityPrompt(input.context, input.activity))}\nMatched prescription: ${JSON.stringify(input.prescription)}`,
    )
    return parseRecommendation(raw, 'post_activity')
  }

  async reviewWeek(input: { context: CoachingContext }): Promise<AdvisorRecommendation> {
    const raw = await request(
      RECOMMENDATION_SCHEMA,
      'Review the rolling running plan. Prefer KEEP when the current future prescription remains appropriate, ADJUST for small workout changes, and REPLAN only for a material change. Never alter completed or past sessions. Keep the output horizon at four weeks.',
      contextPrompt(input.context),
    )
    return parseRecommendation(raw, 'weekly_review')
  }
}
