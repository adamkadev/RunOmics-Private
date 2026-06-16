import type { LLMCompletionRequest, LLMProvider } from '../provider'
import { parseJsonLoose } from '../json'

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

  async complete({ systemPrompt, userPrompt, schema, temperature = 0.4 }: LLMCompletionRequest): Promise<unknown> {
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
          temperature,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'structured_output', strict: false, schema },
          },
        }),
      })

      if (!res.ok) {
        throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`)
      }

      const data = (await res.json()) as OpenAIResponse
      return parseJsonLoose(data.choices?.[0]?.message?.content ?? '')
    } finally {
      clearTimeout(timer)
    }
  }
}
