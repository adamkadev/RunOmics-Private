import type {
  ActivityEvaluationRequest,
  AdvisorRecommendation,
  BootstrapRequest,
  CoachingAdvisor,
  CoachingPlanDraft,
  WeeklyReviewRequest,
} from '@/application/ports/CoachingAdvisor'
import { MODEL_POOL, modelLimits, spacingMs } from '@/domain/ai/budget'
import { generateStructuredJson } from '@/lib/gemini'
import { parseBootstrapPlanDraft, parseRecommendation } from './coachingAnswer'
import { activityEvaluationPrompt, bootstrapPrompt, weeklyReviewPrompt, type CoachingPromptParts } from './coachingPrompt'

export { BOOTSTRAP_PLAN_RESPONSE_SCHEMA, bootstrapEventPrompt, completedActivityPrompt } from './coachingPrompt'

/** Unpinned, the whole pool is tried: a 503 is Google declining this model right now, and the next one usually answers. */
const MODELS = (): string[] => {
  const chosen = process.env.GEMINI_COACH_MODEL || process.env.GEMINI_MODEL
  return chosen ? [chosen] : [...MODEL_POOL]
}
const API_KEY = () => process.env.GEMINI_COACH_API_KEY

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

async function request({ schema, systemInstruction, userPrompt }: CoachingPromptParts): Promise<unknown> {
  const apiKey = API_KEY()
  if (!apiKey) throw new Error('Gemini coaching request failed: GEMINI_COACH_API_KEY is not configured')

  const models = MODELS()
  const reasons: string[] = []

  for (const model of models) {
    await pace(model)
    // No per-model retry: the pool already gives each model one chance, and daily allowances are small.
    const result = await generateStructuredJson({ apiKey, model, systemInstruction, prompt: userPrompt, responseSchema: schema, temperature: 0.2 }, undefined, 0)
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
    return parseBootstrapPlanDraft(await request(bootstrapPrompt(input)))
  }

  async evaluateActivity(input: ActivityEvaluationRequest): Promise<AdvisorRecommendation> {
    return parseRecommendation(await request(activityEvaluationPrompt(input)), 'post_activity')
  }

  async reviewWeek(input: WeeklyReviewRequest): Promise<AdvisorRecommendation> {
    return parseRecommendation(await request(weeklyReviewPrompt(input)), 'weekly_review')
  }
}
