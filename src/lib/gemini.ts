import type { Limits } from '@/domain/ai/prompt'
import { activeLocale } from '@/i18n'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
// Exported because the spender has to reserve this much room before it lets a
// call start: a generation that begins inside the run budget but runs its full
// timeout is what pushes the whole invocation past the serverless ceiling.
// Even at generationConfig.thinkingConfig.thinkingLevel: 'low' below, a
// schema-constrained French answer measured 23s live (360 thinking tokens) -
// 15s was aborting calls that would have succeeded a few seconds later.
export const CALL_TIMEOUT_MS = 30_000

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
  /** One line per read the surface asked for, in the order it listed them. */
  bullets?: string[]
}

export interface InsightRequest {
  /** Per-surface: free-tier quotas are counted per model, see the callers. */
  model: string
  systemInstruction: string
  prompt: string
  limits: Limits
  /** Number of reads the model must phrase; omit for headline + body only. */
  bulletCount?: number
}

/**
 * Failures are reported rather than swallowed: this runs unattended from a
 * GitHub Actions cron, where a silent null looks identical whether the quota
 * ran out, the model was retired or the copy came back too long.
 */
export type InsightResult = { ok: true; insight: Insight } | { ok: false; reason: string }

function responseSchema(bulletCount: number | undefined) {
  const headlineAndBody = {
    type: 'OBJECT',
    properties: {
      headline: { type: 'STRING' },
      body: { type: 'STRING' },
    },
    required: ['headline', 'body'],
  }
  if (bulletCount === undefined) return headlineAndBody

  return {
    ...headlineAndBody,
    properties: {
      ...headlineAndBody.properties,
      bullets: { type: 'ARRAY', items: { type: 'STRING' }, minItems: bulletCount, maxItems: bulletCount },
    },
    required: [...headlineAndBody.required, 'bullets'],
  }
}

type BulletsResult = { ok: true; bullets: string[] } | { ok: false; reason: string }

function parseBullets(raw: unknown, count: number, limit: number): BulletsResult {
  if (!Array.isArray(raw)) return { ok: false, reason: 'bullets missing' }
  if (raw.length !== count) return { ok: false, reason: `${raw.length} bullets, expected ${count}` }

  const bullets = raw.map((b) => (typeof b === 'string' ? b.trim() : ''))
  if (bullets.some((b) => !b)) return { ok: false, reason: 'empty bullet' }

  const overflow = bullets.find((b) => b.length > limit)
  if (overflow) return { ok: false, reason: `bullet ${overflow.length} > ${limit} chars` }

  return { ok: true, bullets }
}

function parseInsight(raw: unknown, limits: Limits, bulletCount?: number): InsightResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'response was not an object' }

  const { headline, body, bullets } = raw as Record<string, unknown>
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

  const parsedBullets = bulletCount === undefined
    ? null
    : parseBullets(bullets, bulletCount, limits.bullet ?? limits.body)
  if (parsedBullets && !parsedBullets.ok) return parsedBullets

  const lines = [trimmedHeadline, trimmedBody, ...(parsedBullets?.bullets ?? [])]
  const combined = lines.join(' ')
  if (combined.includes('—')) return { ok: false, reason: 'em-dash' }

  if (activeLocale === 'fr') {
    if (FRENCH_ELISION_MISSING.test(combined)) return { ok: false, reason: 'french elision missing' }
    if (combined.length > FRENCH_ACCENT_CHECK_MIN_LENGTH && !FRENCH_ACCENT.test(combined)) {
      return { ok: false, reason: 'french text missing all accents' }
    }
  }

  const insight = { headline: trimmedHeadline, body: trimmedBody }
  return { ok: true, insight: parsedBullets ? { ...insight, bullets: parsedBullets.bullets } : insight }
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
          responseSchema: responseSchema(request.bulletCount),
          temperature: 1.1,
          // Gemini 3.x has no way to turn thinking off (2.5's thinkingBudget: 0
          // does not apply to this family) - 'low' is the floor, and it still
          // spends real tokens on a schema-constrained answer. See
          // CALL_TIMEOUT_MS for why the timeout still has headroom above it.
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
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

    return parseInsight(JSON.parse(text), request.limits, request.bulletCount)
  } catch (error) {
    return { ok: false, reason: `${error instanceof Error ? error.name : 'error'}: ${String(error).slice(0, 120)}` }
  }
}
