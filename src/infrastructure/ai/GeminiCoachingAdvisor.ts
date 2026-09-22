import type { Activity } from '@/domain/activity/types'
import {
  COACHING_SCHEMA_VERSION,
  type CoachEvidence,
  type TrainingWeek,
  type WorkoutPrescription,
  type WorkoutRepeatBlock,
  type WorkoutSegment,
} from '@/domain/coaching/types'
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
import { MODEL_POOL, modelLimits, spacingMs } from '@/domain/ai/budget'
import { MAX_BOOTSTRAP_WEEKS } from '@/domain/coaching/weekWindows'
import { generateStructuredJson } from '@/lib/gemini'
import {
  ADAPTATION_WEEK_SCHEMA,
  ADAPTATION_WORKOUT_SCHEMA,
  BOOTSTRAP_PLAN_RESPONSE_SCHEMA,
  BOOTSTRAP_SYSTEM_INSTRUCTION,
  bootstrapUserPrompt,
  contextPrompt,
} from './coachingPrompt'

export { BOOTSTRAP_PLAN_RESPONSE_SCHEMA, bootstrapEventPrompt } from './coachingPrompt'

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

/**
 * Google allows five requests a minute on these models and reports going over
 * as 503 "high demand", the same words it uses for a spent daily quota. One
 * bootstrap can ask several times - once per pooled model, again per repair -
 * so without pacing a single command outruns the minute by itself.
 */
export const pacing = {
  lastRequestAt: 0,
  now: () => Date.now(),
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}

async function pace(model: string): Promise<void> {
  const delay = Math.max(0, pacing.lastRequestAt + spacingMs(model) - pacing.now())
  if (delay > 0) await pacing.sleep(delay)
  pacing.lastRequestAt = pacing.now()
}

async function request(schema: Record<string, unknown>, systemInstruction: string, prompt: string): Promise<unknown> {
  const apiKey = API_KEY()
  if (!apiKey) throw new Error('Gemini coaching request failed: GEMINI_COACH_API_KEY is not configured')

  const models = MODELS()
  const reasons: string[] = []

  for (const model of models) {
    await pace(model)
    // No per-model retry: walking the pool already gives one independent
    // chance per model, and the pooled models allow only 20 requests a day
    // each, so retrying one of them is the expensive way to buy the same odds.
    const result = await generateStructuredJson({ apiKey, model, systemInstruction, prompt, responseSchema: schema, temperature: 0.2 }, undefined, 0)
    if (result.ok) return result.value
    reasons.push(`${model}: ${result.reason}`)
  }

  throw new Error(`Gemini coaching request failed: ${reasons.join(' | ')}.${quotaHint(models, reasons)}`)
}

/**
 * Google reports an exhausted daily quota as 503 "high demand", which reads as
 * a passing outage and sends the operator back to re-run it - spending more of
 * the quota that ran out. Each model carries its own allowance, so a pinned
 * model is also a third of the capacity.
 */
function quotaHint(models: string[], reasons: string[]): string {
  if (!reasons.every((reason) => reason.includes('503'))) return ''

  const allowance = models.map((model) => `${model} allows ${modelLimits(model).rpd}/day`).join(', ')
  const reset = 'a spent daily quota is reported this way and resets at midnight America/Los_Angeles'

  if (models.length > 1) return ` Every pooled model refused: ${allowance}; ${reset}.`

  return ` Only ${models[0]} was tried because GEMINI_COACH_MODEL or GEMINI_MODEL names it: ${allowance}; ${reset}. Unset it to let the whole pool answer, each with its own allowance.`
}

export class GeminiCoachingAdvisor implements CoachingAdvisor {
  async bootstrap(input: BootstrapRequest): Promise<CoachingPlanDraft> {
    const raw = await request(BOOTSTRAP_PLAN_RESPONSE_SCHEMA, BOOTSTRAP_SYSTEM_INSTRUCTION, bootstrapUserPrompt(input))
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
