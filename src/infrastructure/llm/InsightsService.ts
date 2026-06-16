import type { InsightsInput, InsightsOutput, LLMProvider } from './types'
import { ruleBasedInsights } from './fallback'

export type InsightsSource = 'llm' | 'fallback'

export interface InsightsResult {
  output: InsightsOutput
  source: InsightsSource
  provider: string | null
}

// Orchestrates a single provider: delegates generation, and on ANY failure
// (no provider configured, network error, timeout, invalid JSON) returns
// deterministic rule-based insights so the caller never has to handle errors.
export class InsightsService {
  constructor(private readonly provider: LLMProvider | null) {}

  async getInsights(input: InsightsInput): Promise<InsightsResult> {
    if (!this.provider) {
      return { output: ruleBasedInsights(input), source: 'fallback', provider: null }
    }

    try {
      const output = await this.provider.generateInsights(input)
      return { output, source: 'llm', provider: this.provider.name }
    } catch (error) {
      console.error('[insights] provider failed, using fallback:', error)
      return { output: ruleBasedInsights(input), source: 'fallback', provider: this.provider.name }
    }
  }
}
