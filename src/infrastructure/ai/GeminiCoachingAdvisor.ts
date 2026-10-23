import type { Activity } from '@/domain/activity/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import type {
  AdvisorRecommendation,
  BootstrapRequest,
  CoachingAdvisor,
  CoachingPlanDraft,
} from '@/application/ports/CoachingAdvisor'
import type { CoachingContext } from '@/application/coaching/context'
import { garminMeasured } from '@/domain/activity/raceResult'
import { MODEL_POOL, modelLimits, spacingMs } from '@/domain/ai/budget'
import { generateStructuredJson } from '@/lib/gemini'
import { parseBootstrapPlanDraft, parseRecommendation } from './coachingAnswer'
import {
  ADAPTATION_NAMING_RULE,
  ADAPTATION_WEEK_SCHEMA,
  ADAPTATION_WORKOUT_SCHEMA,
  BOOTSTRAP_PLAN_RESPONSE_SCHEMA,
  BOOTSTRAP_SYSTEM_INSTRUCTION,
  bootstrapUserPrompt,
  contextPrompt,
  withCoachingLanguage,
} from './coachingPrompt'

export { BOOTSTRAP_PLAN_RESPONSE_SCHEMA, bootstrapEventPrompt } from './coachingPrompt'

/** Unpinned, the whole pool is tried: a 503 is Google declining this model right now, and the next one usually answers. */
const MODELS = (): string[] => {
  const chosen = process.env.GEMINI_COACH_MODEL || process.env.GEMINI_MODEL
  return chosen ? [chosen] : [...MODEL_POOL]
}
const API_KEY = () => process.env.GEMINI_COACH_API_KEY

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

/** Google reports going over its per-minute limit as 503 "high demand", and one bootstrap can ask several times. */
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
    // No per-model retry: the pool already gives each model one chance, and daily allowances are small.
    const result = await generateStructuredJson({ apiKey, model, systemInstruction, prompt, responseSchema: schema, temperature: 0.2 }, undefined, 0)
    if (result.ok) return result.value
    reasons.push(`${model}: ${result.reason}`)
  }

  throw new Error(`Gemini coaching request failed: ${reasons.join(' | ')}.${quotaHint(models, reasons)}`)
}

/** Google reports an exhausted daily quota as 503 "high demand", which reads as a passing outage worth re-running. */
function quotaHint(models: string[], reasons: string[]): string {
  if (!reasons.every((reason) => reason.includes('503'))) return ''

  const allowance = models.map((model) => `${model} allows ${modelLimits(model).rpd}/day`).join(', ')
  const reset = 'a spent daily quota is reported this way and resets at midnight America/Los_Angeles'

  if (models.length > 1) return ` Every pooled model refused: ${allowance}; ${reset}.`

  return ` Only ${models[0]} was tried because GEMINI_COACH_MODEL or GEMINI_MODEL names it: ${allowance}; ${reset}. Unset it to let the whole pool answer, each with its own allowance.`
}

export class GeminiCoachingAdvisor implements CoachingAdvisor {
  readonly source = 'gemini' as const
  async bootstrap(input: BootstrapRequest): Promise<CoachingPlanDraft> {
    const raw = await request(BOOTSTRAP_PLAN_RESPONSE_SCHEMA, BOOTSTRAP_SYSTEM_INSTRUCTION, bootstrapUserPrompt(input))
    return parseBootstrapPlanDraft(raw)
  }

  async evaluateActivity(input: { context: CoachingContext; activity: Activity; prescription: WorkoutPrescription | null }): Promise<AdvisorRecommendation> {
    const raw = await request(
      RECOMMENDATION_SCHEMA,
      withCoachingLanguage(`Evaluate the completed run and choose KEEP, ADJUST, or REPLAN. Normal runs should usually be KEEP. Use ADJUST only for small future workout changes and REPLAN only for meaningful events. Never alter completed or past sessions. Reasons and evidence must cite supplied facts. ${ADAPTATION_NAMING_RULE}`),
      `${contextPrompt(input.context)}\nCompleted activity: ${JSON.stringify(completedActivityPrompt(input.context, input.activity))}\nMatched prescription: ${JSON.stringify(input.prescription)}`,
    )
    return parseRecommendation(raw, 'post_activity')
  }

  async reviewWeek(input: { context: CoachingContext }): Promise<AdvisorRecommendation> {
    const raw = await request(
      RECOMMENDATION_SCHEMA,
      withCoachingLanguage(`Review the rolling running plan. Prefer KEEP when the current future prescription remains appropriate, ADJUST for small workout changes, and REPLAN only for a material change. Never alter completed or past sessions. Keep the output horizon at four weeks. ${ADAPTATION_NAMING_RULE}`),
      contextPrompt(input.context),
    )
    return parseRecommendation(raw, 'weekly_review')
  }
}
