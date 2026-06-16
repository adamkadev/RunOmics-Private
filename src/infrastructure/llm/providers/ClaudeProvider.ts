import type { InsightsInput, InsightsOutput, LLMProvider } from '../types'
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt'
import { parseInsightsOutput, parseJsonLoose } from '../schema'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const TIMEOUT_MS = 12_000

interface ClaudeResponse {
  content?: { type: string; text?: string }[]
}

export interface ClaudeOptions {
  apiKey: string
  model?: string
}

// Future fallback target. Anthropic has no JSON response_format, so we rely on
// the JSON-only system prompt plus tolerant parsing (parseJsonLoose).
export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude'
  private readonly apiKey: string
  private readonly model: string

  constructor({ apiKey, model }: ClaudeOptions) {
    if (!apiKey) throw new Error('ClaudeProvider requires an apiKey')
    this.apiKey = apiKey
    this.model = model ?? DEFAULT_MODEL
  }

  async generateInsights(input: InsightsInput): Promise<InsightsOutput> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildUserPrompt(input) }],
        }),
      })

      if (!res.ok) {
        throw new Error(`Claude request failed: ${res.status} ${await res.text()}`)
      }

      const data = (await res.json()) as ClaudeResponse
      const text = data.content?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') ?? ''
      const parsed = parseInsightsOutput(parseJsonLoose(text))
      if (!parsed) throw new Error('Claude returned no valid insights')
      return parsed
    } finally {
      clearTimeout(timer)
    }
  }
}
