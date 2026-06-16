import type { InsightsInput, InsightsOutput, LLMProvider } from '../types'
import { JSON_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from '../prompt'
import { parseInsightsOutput, parseJsonLoose } from '../schema'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MODEL = 'gpt-4o-mini'
const TIMEOUT_MS = 12_000

interface OpenAIResponse {
  choices?: { message?: { content?: string } }[]
}

export interface OpenAIOptions {
  apiKey: string
  model?: string
}

// Future swap target. Same prompt + schema as Gemini, different transport.
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai'
  private readonly apiKey: string
  private readonly model: string

  constructor({ apiKey, model }: OpenAIOptions) {
    if (!apiKey) throw new Error('OpenAIProvider requires an apiKey')
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
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          temperature: 0.4,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(input) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'insights', strict: false, schema: JSON_SCHEMA },
          },
        }),
      })

      if (!res.ok) {
        throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`)
      }

      const data = (await res.json()) as OpenAIResponse
      const text = data.choices?.[0]?.message?.content ?? ''
      const parsed = parseInsightsOutput(parseJsonLoose(text))
      if (!parsed) throw new Error('OpenAI returned no valid insights')
      return parsed
    } finally {
      clearTimeout(timer)
    }
  }
}
