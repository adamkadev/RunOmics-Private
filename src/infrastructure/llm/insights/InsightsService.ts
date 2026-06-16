import type { LLMProvider } from '../provider'
import type { InsightsInput, InsightsOutput } from './types'
import { JSON_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from './prompt'
import { parseInsightsOutput } from './schema'

export type InsightsSource = 'llm' | 'unavailable'

export interface InsightsResult {
  output: InsightsOutput
  source: InsightsSource
  provider: string | null
}

const EMPTY: InsightsOutput = { insights: [] }

// Builds the insights request, delegates to the provider, validates the JSON.
// There is no rule-based fallback by design: when the LLM is unavailable or
// fails, insights are simply empty and the UI hides the card.
export class InsightsService {
  constructor(private readonly provider: LLMProvider | null) {}

  async getInsights(input: InsightsInput): Promise<InsightsResult> {
    if (!this.provider) {
      return { output: EMPTY, source: 'unavailable', provider: null }
    }

    try {
      const raw = await this.provider.complete({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(input),
        schema: JSON_SCHEMA,
        temperature: 0.4,
      })
      const output = parseInsightsOutput(raw)
      if (!output) throw new Error('provider returned no valid insights')
      return { output, source: 'llm', provider: this.provider.name }
    } catch (error) {
      console.error('[insights] provider failed:', error)
      return { output: EMPTY, source: 'unavailable', provider: this.provider.name }
    }
  }
}
