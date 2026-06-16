import type { LLMCompletionRequest, LLMProvider } from '../provider'
import { parseJsonLoose } from '../json'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4o-mini'
const TIMEOUT_MS = 12_000

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[]
}

export interface OpenRouterOptions {
  apiKey: string
  model?: string
}

// OpenAI-compatible chat completions API that proxies many models (Gemini,
// Llama, DeepSeek, etc). Same transport shape as OpenAIProvider, different
// endpoint/headers - lets us test arbitrary models without a new SDK.
export class OpenRouterProvider implements LLMProvider {
  readonly name = 'openrouter'
  private readonly apiKey: string
  private readonly model: string

  constructor({ apiKey, model }: OpenRouterOptions) {
    if (!apiKey) throw new Error('OpenRouterProvider requires an apiKey')
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
          'X-Title': 'RunOmics',
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
        throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`)
      }

      const data = (await res.json()) as OpenRouterResponse
      return parseJsonLoose(data.choices?.[0]?.message?.content ?? '')
    } finally {
      clearTimeout(timer)
    }
  }
}
