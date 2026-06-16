import type { LLMProvider } from '../provider'
import { GeminiProvider } from './GeminiProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { ClaudeProvider } from './ClaudeProvider'

export { GeminiProvider, OpenAIProvider, ClaudeProvider }

type ProviderName = 'gemini' | 'openai' | 'claude'

// Single place that wires env to a concrete provider. Swap providers here (or
// via INSIGHTS_PROVIDER) without touching any other code. Returns null when no
// key is configured, so the service falls back to deterministic insights.
export function createProvider(): LLMProvider | null {
  const preferred = (process.env.INSIGHTS_PROVIDER as ProviderName | undefined) ?? 'gemini'

  const factories: Record<ProviderName, () => LLMProvider | null> = {
    gemini: () =>
      process.env.GEMINI_API_KEY
        ? new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL })
        : null,
    openai: () =>
      process.env.OPENAI_API_KEY
        ? new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL })
        : null,
    claude: () =>
      process.env.ANTHROPIC_API_KEY
        ? new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL })
        : null,
  }

  return factories[preferred]?.() ?? null
}
