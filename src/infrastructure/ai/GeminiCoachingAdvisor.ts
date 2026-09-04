import type { Activity } from '@/domain/activity/types'
import { COACHING_SCHEMA_VERSION, type CoachEvidence, type CoachingPlan, type TrainingWeek, type WorkoutPrescription } from '@/domain/coaching/types'
import { parseCoachingPlan, parseWorkoutPrescription } from '@/domain/coaching/validation'
import type {
  AdvisorPlanChange,
  AdvisorRecommendation,
  BootstrapRequest,
  CoachingAdvisor,
} from '@/application/ports/CoachingAdvisor'
import type { CoachingContext } from '@/application/coaching/context'
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

const WORKOUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    id: { type: 'STRING' },
    date: { type: 'STRING' },
    type: { type: 'STRING', enum: ['easy', 'recovery', 'long_run', 'tempo', 'threshold', 'vo2max', 'anaerobic', 'sprint', 'race'] },
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    totalDurationSeconds: { type: 'INTEGER' },
    totalDistanceMeters: { type: 'INTEGER' },
    blocks: { type: 'ARRAY', items: BLOCK_SCHEMA },
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['date', 'type', 'title', 'description', 'blocks'],
}

const WEEK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    id: { type: 'STRING' },
    startDate: { type: 'STRING' },
    endDate: { type: 'STRING' },
    focus: { type: 'STRING' },
    workouts: { type: 'ARRAY', items: WORKOUT_SCHEMA },
  },
  required: ['startDate', 'endDate', 'focus', 'workouts'],
}

const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    focus: { type: 'STRING' },
    weeks: { type: 'ARRAY', items: WEEK_SCHEMA, minItems: 1, maxItems: 4 },
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
    workout: WORKOUT_SCHEMA,
    effectiveDate: { type: 'STRING' },
    weeks: { type: 'ARRAY', items: WEEK_SCHEMA },
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

function parsePlanDraft(value: unknown, request: BootstrapRequest): CoachingPlan {
  const raw = record(value, 'plan')
  const weeks = draftWeeks(raw.weeks, 'bootstrap')
  return parseCoachingPlan({
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: 'draft-plan',
    revision: 1,
    status: 'active',
    block: {
      id: 'draft-block',
      name: text(raw.name, 'plan.name'),
      startDate: weeks[0]!.startDate,
      endDate: weeks[weeks.length - 1]!.endDate,
      focus: text(raw.focus, 'plan.focus'),
    },
    targetEvent: { id: 'draft-event', name: 'Draft event', date: request.context.upcomingRaces[0]?.date ?? '2099-01-01' },
    goal: { kind: 'finish', description: 'Draft goal' },
    weeks,
    provenance: PLACEHOLDER_PROVENANCE,
  })
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

async function request(schema: Record<string, unknown>, systemInstruction: string, prompt: string): Promise<unknown> {
  const result = await generateStructuredJson({ model: MODEL(), systemInstruction, prompt, responseSchema: schema, temperature: 0.2 })
  if (!result.ok) throw new Error(`Gemini coaching request failed: ${result.reason}`)
  return result.value
}

export class GeminiCoachingAdvisor implements CoachingAdvisor {
  async bootstrap(input: BootstrapRequest): Promise<CoachingPlan> {
    const raw = await request(
      PLAN_SCHEMA,
      'Create a conservative four-week running prescription. Use only the supplied dates, athlete metrics, target ranges and available weekdays. Return structured workouts, not prose-only sessions. Do not calculate new physiological metrics.',
      `${contextPrompt(input.context)}\nAvailable UTC weekdays (0=Sun): ${input.availableWeekdays.join(',')}\nTarget event override: ${input.targetEventId ?? 'nearest upcoming race'}`,
    )
    return parsePlanDraft(raw, input)
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
