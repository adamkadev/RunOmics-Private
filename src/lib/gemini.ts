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

/**
 * Failures are reported rather than swallowed: this runs unattended from a
 * GitHub Actions cron, where a silent null looks identical whether the quota
 * ran out, the model was retired or the copy came back too long.
 */
export type InsightResult = { ok: true; insight: Insight } | { ok: false; reason: string }

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    body: { type: 'STRING' },
  },
  required: ['headline', 'body'],
} as const

function parseInsight(raw: unknown, limits: Limits): InsightResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'response was not an object' }

  const { headline, body } = raw as Record<string, unknown>
  if (typeof headline !== 'string' || typeof body !== 'string') {
    return { ok: false, reason: 'headline or body missing' }
  }

  const trimmedHeadline = headline.trim()
  const trimmedBody = body.trim()
  if (!trimmedHeadline || !trimmedBody) return { ok: false, reason: 'headline or body empty' }
  if (trimmedHeadline.length > limits.headline) {
    return { ok: false, reason: `headline ${trimmedHeadline.length} > ${limits.headline} chars` }
  }
  if (trimmedBody.length > limits.body) {
    return { ok: false, reason: `body ${trimmedBody.length} > ${limits.body} chars` }
  }
  if (trimmedHeadline.includes('—') || trimmedBody.includes('—')) return { ok: false, reason: 'em-dash' }

  return { ok: true, insight: { headline: trimmedHeadline, body: trimmedBody } }
}

export async function generateInsight(request: InsightRequest): Promise<InsightResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { ok: false, reason: 'no api key' }

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

    if (!res.ok) return { ok: false, reason: `http ${res.status}: ${(await res.text()).slice(0, 200)}` }

    const json = await res.json()
    // Thinking models put reasoning parts alongside the answer, and not always
    // last, so take the first part that actually carries text.
    const parts: { text?: unknown }[] = json?.candidates?.[0]?.content?.parts ?? []
    const text = parts.find((part) => typeof part.text === 'string')?.text
    if (typeof text !== 'string') {
      return { ok: false, reason: `no text part (finish: ${json?.candidates?.[0]?.finishReason ?? 'none'})` }
    }

    return parseInsight(JSON.parse(text), request.limits)
  } catch (error) {
    return { ok: false, reason: `${error instanceof Error ? error.name : 'error'}: ${String(error).slice(0, 120)}` }
  }
}
