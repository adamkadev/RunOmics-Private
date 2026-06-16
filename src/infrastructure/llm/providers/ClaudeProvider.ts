import type { LLMCompletionRequest, LLMProvider } from '../provider'
import { parseJsonLoose } from '../json'

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

// Future fallback target. Anthropic has no JSON response_format, so we inline
// the JSON schema into the system prompt and rely on tolerant parsing.
export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude'
  private readonly apiKey: string
  private readonly model: string

  constructor({ apiKey, model }: ClaudeOptions) {
    if (!apiKey) throw new Error('ClaudeProvider requires an apiKey')
    this.apiKey = apiKey
    this.model = model ?? DEFAULT_MODEL
  }

  async complete({ systemPrompt, userPrompt, schema, temperature = 0.4 }: LLMCompletionRequest): Promise<unknown> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const system = `${systemPrompt}\n\nThe JSON object MUST conform to this JSON Schema:\n${JSON.stringify(schema)}`

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
          temperature,
          system,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (!res.ok) {
        throw new Error(`Claude request failed: ${res.status} ${await res.text()}`)
      }

      const data = (await res.json()) as ClaudeResponse
      const text = data.content?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') ?? ''
      return parseJsonLoose(text)
    } finally {
      clearTimeout(timer)
    }
  }
}
