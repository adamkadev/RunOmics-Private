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
import { bootstrapRecoveryFacts } from '@/application/coaching/bootstrapValidation'
import { MODEL_POOL } from '@/domain/ai/budget'
import { generateStructuredJson } from '@/lib/gemini'

const MODEL = () => process.env.GEMINI_COACH_MODEL || process.env.GEMINI_MODEL || MODEL_POOL[0]!
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
    weeks: { type: 'ARRAY', items: BOOTSTRAP_WEEK_SCHEMA, minItems: 1, maxItems: 4 },
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
  // Reuse the segment/range/date validator on one workout at a time. The
  // synthetic metadata exists only for structural parsing and is discarded;
  // model-supplied IDs and totals are intentionally ignored.
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
  if (weeks.length === 0 || weeks.length > 4) throw new Error('plan.weeks must contain 1 to 4 weeks')
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

function contextPrompt(context: CoachingContext): string {
  return `Structured coaching context:\n${JSON.stringify(context)}`
}

export function bootstrapEventPrompt(event: BootstrapRequest['primaryTargetEvent']): Record<string, unknown> {
  return { ...event, ...raceTargetFacts(event) }
}

async function request(schema: Record<string, unknown>, systemInstruction: string, prompt: string): Promise<unknown> {
  const result = await generateStructuredJson({ model: MODEL(), systemInstruction, prompt, responseSchema: schema, temperature: 0.2 })
  if (!result.ok) throw new Error(`Gemini coaching request failed: ${result.reason}`)
  return result.value
}

export class GeminiCoachingAdvisor implements CoachingAdvisor {
  async bootstrap(input: BootstrapRequest): Promise<CoachingPlanDraft> {
    const horizonDays = Math.round((
      new Date(`${input.horizonEndDate}T00:00:00Z`).getTime()
      - new Date(`${input.planningStartDate}T00:00:00Z`).getTime()
    ) / 86_400_000) + 1
    const weekCount = Math.ceil(horizonDays / 7)
    const recovery = bootstrapRecoveryFacts(input.context, input.planningStartDate)
    const raw = await request(
      BOOTSTRAP_PLAN_RESPONSE_SCHEMA,
      'Create a conservative running prescription for the supplied planning period. PRIMARY_TARGET is the only block target; TUNE_UP_EVENTS are independent secondary races that support it. Include every tune-up inside the planning period as a race workout on its event date, and taper or sharpen appropriately beforehand; do not place a normal tempo, threshold, VO2max, anaerobic, sprint, or long-run session within two days of a tune-up race. When POST_RACE_RECOVERY.required is true, every prescribed session through recoveryThroughDate must be easy or recovery only: no tempo, threshold, VO2max, anaerobic, sprint, race, or long run. Recent consistency, gaps, acute/chronic load, ACWR, load status, and TSB must inform how cautiously quality and volume resume; the first quality session may move into the following week. For a 10K PRIMARY_TARGET, emphasize aerobic consistency, threshold development, and long-run durability, with at most one separate faster 5K-specific/VO2 stimulus in this rolling block; a 5K tune-up can itself provide that faster stimulus. For every event, hasExplicitGoal and targetSeconds apply only to that event. Never copy a primary goal to a tune-up. When hasExplicitGoal is false, do not call any finish time an event goal; an AI-recommended pace must be described as a recommendation and encoded in paceSecPerKm. Pace and finish-time conversions are deterministic inputs: never calculate, infer, or narrate a finish time from a pace. You may repeat supplied targetFinishTime and targetPace values verbatim for that same event only. Keep plan names, plan focus, and week focus free of numeric pace or finish-time targets. Race workouts must occur on a supplied event date. Do not schedule anything outside the planning period. Use only supplied dates, athlete metrics, goals, target ranges, and available weekdays. Treat supplied hrZoneBoundsBpm as authoritative Garmin zone boundaries; do not recalculate HR zones from max HR or LTHR. Workout names and descriptions must match their blocks: call a workout progressive only when multiple blocks encode an actual rise in intensity. Hill repetitions must use effort/RPE or form guidance (with HR only as secondary guidance), never a rigid flat-ground pace target; use a normal flat interval workout if pace is the execution target, and encode qualitative effort/RPE/form guidance in segment notes. If a workout includes strides, encode every intended repetition as a repeat block containing a timed strides step and a recovery step (normally 4–6 × 20 seconds when appropriate); never emit a single standalone strides block and never omit or invent the repetition count. Do not assign hrZone or hrBpm to strides because HR response lags; guide them by pace or encode effort, relaxed speed, and form in segment notes. Return structured workouts, not prose-only sessions. Do not calculate new physiological metrics.',
      `${contextPrompt(input.context)}\nPOST_RACE_RECOVERY: ${JSON.stringify(recovery)}\nPRIMARY_TARGET: ${JSON.stringify(bootstrapEventPrompt(input.primaryTargetEvent))}\nTUNE_UP_EVENTS (each goal is independent): ${JSON.stringify(input.tuneUpEvents.map(bootstrapEventPrompt))}\nAvailable UTC weekdays (0=Sun): ${input.availableWeekdays.join(',')}\nPlan starts: ${input.planningStartDate}\nPlan horizon ends: ${input.horizonEndDate}\nReturn exactly ${weekCount} week${weekCount === 1 ? '' : 's'}, with no week or workout extending outside the planning period.\nUser target override: ${input.targetEventId ?? 'none'}`,
    )
    return parseBootstrapPlanDraft(raw)
  }

  async evaluateActivity(input: { context: CoachingContext; activity: Activity; prescription: WorkoutPrescription | null }): Promise<AdvisorRecommendation> {
    const raw = await request(
      RECOMMENDATION_SCHEMA,
      'Evaluate the completed run and choose KEEP, ADJUST, or REPLAN. Normal runs should usually be KEEP. Use ADJUST only for small future workout changes and REPLAN only for meaningful events. Never alter completed or past sessions. Reasons and evidence must cite supplied facts.',
      `${contextPrompt(input.context)}\nCompleted activity: ${JSON.stringify({ id: input.activity.id, date: input.activity.date, type: input.activity.type, distanceKm: input.activity.distanceKm, durationSeconds: input.activity.durationSeconds, paceSecPerKm: input.activity.paceSecPerKm, avgHeartRate: input.activity.avgHeartRate, rpe: input.activity.rpe })}\nMatched prescription: ${JSON.stringify(input.prescription)}`,
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
