import type { Limits } from '@/domain/ai/prompt'
import { activeLocale } from '@/i18n'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 15_000

// Some models drop French typography under constrained JSON output - seen in
// the wild from gemini-3.5-flash-lite. Both checks reject rather than repair:
// a rejected candidate just stays in the backfill queue for the next pass.
//
// A dropped elision ("L effort" instead of "L'effort") is unambiguous - these
// function words always contract before a vowel, so the miss is easy to spot.
const FRENCH_ELISION_MISSING = /\b(?:[LldDsScCnNjJtTmM]|[Qq]ue)\s+(?=[aeiouyàâäéèêëïîôöùûühAEIOUYÀÂÄÉÈÊËÏÎÔÖÙÛÜH])/
// Accent restoration is not - "seance"/"séance" can't be told apart by regex -
// but French this long virtually always contains at least one accented letter
// (séance, récupération, développement...), so a total absence is a strong
// signal the model dropped diacritics rather than a genuinely accent-free
// sentence.
const FRENCH_ACCENT = /[àâäéèêëïîôöùûüçÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ]/
const FRENCH_ACCENT_CHECK_MIN_LENGTH = 40

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

  if (activeLocale === 'fr') {
    const combined = `${trimmedHeadline} ${trimmedBody}`
    if (FRENCH_ELISION_MISSING.test(combined)) return { ok: false, reason: 'french elision missing' }
    if (combined.length > FRENCH_ACCENT_CHECK_MIN_LENGTH && !FRENCH_ACCENT.test(combined)) {
      return { ok: false, reason: 'french text missing all accents' }
    }
  }

  return { ok: true, insight: { headline: trimmedHeadline, body: trimmedBody } }
}

export async function generateInsight(request: InsightRequest): Promise<InsightResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { ok: false, reason: 'no api key' }

  // The model is whatever the spender reserved budget for - overriding it here
  // would bill one model's ledger for another model's call. The GEMINI_MODEL
  // escape hatch lives in lib/aiSpend, where it replaces the pool instead.
  try {
    const res = await fetch(`${ENDPOINT}/${request.model}:generateContent`, {
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
