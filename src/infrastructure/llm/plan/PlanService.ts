import type { LLMProvider } from '../provider'
import type { PlanInput, PlanOutput } from './types'
import { PLAN_JSON_SCHEMA, PLAN_SYSTEM_PROMPT, buildPlanUserPrompt } from './prompt'
import { parsePlanOutput } from './schema'

export type PlanSource = 'llm' | 'unavailable'

export interface PlanResult {
  output: PlanOutput
  source: PlanSource
  provider: string | null
}

const EMPTY: PlanOutput = { plan: null }

// Builds the plan request, delegates to the provider, validates the JSON.
// There is no rule-based fallback by design: when the LLM is unavailable or
// fails, the plan is null and the Coach page hides the card.
export class PlanService {
  constructor(private readonly provider: LLMProvider | null) {}

  async getPlan(input: PlanInput): Promise<PlanResult> {
    if (!this.provider) {
      return { output: EMPTY, source: 'unavailable', provider: null }
    }

    try {
      const raw = await this.provider.complete({
        systemPrompt: PLAN_SYSTEM_PROMPT,
        userPrompt: buildPlanUserPrompt(input),
        schema: PLAN_JSON_SCHEMA,
        temperature: 0.5,
      })
      const output = parsePlanOutput(raw)
      if (!output) throw new Error('provider returned no valid plan')
      return { output, source: 'llm', provider: this.provider.name }
    } catch (error) {
      console.error('[plan] provider failed:', error)
      return { output: EMPTY, source: 'unavailable', provider: this.provider.name }
    }
  }
}
