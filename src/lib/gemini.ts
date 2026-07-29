import type { Limits } from '@/domain/ai/prompt'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 15_000

export interface Insight {
  headline: string
  body: string
}

export interface InsightRequest {
  /** Per-surface: free-tier quotas are counted per model, see the callers. */
  model: string
  systemInstruction: string
  prompt: string
  limits: Limits
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    body: { type: 'STRING' },
  },
  required: ['headline', 'body'],
} as const

function parseInsight(raw: unknown, limits: Limits): Insight | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { headline, body } = raw as Record<string, unknown>
  if (typeof headline !== 'string' || typeof body !== 'string') return null

  const trimmedHeadline = headline.trim()
  const trimmedBody = body.trim()
  if (!trimmedHeadline || !trimmedBody) return null
  if (trimmedHeadline.length > limits.headline || trimmedBody.length > limits.body) return null
  if (trimmedHeadline.includes('—') || trimmedBody.includes('—')) return null

  return { headline: trimmedHeadline, body: trimmedBody }
}

export async function generateInsight(request: InsightRequest): Promise<Insight | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  // Escape hatch: Google retires models and closes old ones to new keys with no
  // warning, so one env var can move every surface at once.
  const model = process.env.GEMINI_MODEL || request.model

  try {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: request.systemInstruction }] },
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 1.1,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      console.error('[gemini]', res.status, await res.text())
      return null
    }

    const json = await res.json()
    // Thinking models put reasoning parts alongside the answer, and not always
    // last, so take the first part that actually carries text.
    const parts: { text?: unknown }[] = json?.candidates?.[0]?.content?.parts ?? []
    const text = parts.find((part) => typeof part.text === 'string')?.text
    if (typeof text !== 'string') return null

    return parseInsight(JSON.parse(text), request.limits)
  } catch (error) {
    console.error('[gemini]', error)
    return null
  }
}
