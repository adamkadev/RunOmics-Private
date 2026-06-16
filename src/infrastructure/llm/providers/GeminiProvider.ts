import type { LLMCompletionRequest, LLMProvider } from '../provider'
import { parseJsonLoose } from '../json'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.0-flash'
const TIMEOUT_MS = 12_000

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

export interface GeminiOptions {
  apiKey: string
  model?: string
}

// Google Gemini via the REST API (no SDK dependency). Uses native structured
// output (responseMimeType + responseSchema) to force valid JSON.
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini'
  private readonly apiKey: string
  private readonly model: string

  constructor({ apiKey, model }: GeminiOptions) {
    if (!apiKey) throw new Error('GeminiProvider requires an apiKey')
    this.apiKey = apiKey
    this.model = model ?? DEFAULT_MODEL
  }

  async complete({ systemPrompt, userPrompt, schema, temperature = 0.4 }: LLMCompletionRequest): Promise<unknown> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(
        `${ENDPOINT}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature,
              responseMimeType: 'application/json',
              responseSchema: schema,
            },
          }),
        },
      )

      if (!res.ok) {
        throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`)
      }

      const data = (await res.json()) as GeminiResponse
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      return parseJsonLoose(text)
    } finally {
      clearTimeout(timer)
    }
  }
}
