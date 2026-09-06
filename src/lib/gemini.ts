import type { Limits } from '@/domain/ai/prompt'
import { activeLocale } from '@/i18n'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
export const CALL_TIMEOUT_MS = 30_000

const FRENCH_ELISION_MISSING = /\b(?:[LldDsScCnNjJtTmM]|[Qq]ue)\s+(?=[aeiouyàâäéèêëïîôöùûühAEIOUYÀÂÄÉÈÊËÏÎÔÖÙÛÜH])/
const FRENCH_ACCENT = /[àâäéèêëïîôöùûüçÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ]/
const FRENCH_ACCENT_CHECK_MIN_LENGTH = 40

export interface Insight {
  headline: string
  body: string
  bullets?: string[]
}

export interface InsightRequest {
  model: string
  systemInstruction: string
  prompt: string
  limits: Limits
  bulletCount?: number
}

export type InsightResult = { ok: true; insight: Insight } | { ok: false; reason: string }

export type StructuredResult<T> = { ok: true; value: T } | { ok: false; reason: string }

export interface StructuredRequest {
  apiKey: string
  model: string
  systemInstruction: string
  prompt: string
  responseSchema: Record<string, unknown>
  temperature?: number
}

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

  const result = await generateStructuredJson({
    apiKey,
    model: request.model,
    systemInstruction: request.systemInstruction,
    prompt: request.prompt,
    responseSchema: responseSchema(request.bulletCount),
    temperature: 1.1,
  })
  if (!result.ok) return result

  try {
    return parseInsight(result.value, request.limits, request.bulletCount)
  } catch (error) {
    return { ok: false, reason: `parse error: ${String(error).slice(0, 120)}` }
  }
}

export async function generateStructuredJson(request: StructuredRequest): Promise<StructuredResult<unknown>> {
  try {
    const res = await fetch(`${ENDPOINT}/${request.model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': request.apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: request.systemInstruction }] },
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: request.responseSchema,
          temperature: request.temperature ?? 0.4,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    })

    if (!res.ok) return { ok: false, reason: `http ${res.status}: ${(await res.text()).slice(0, 200)}` }

    const json = await res.json()
    const parts: { text?: unknown }[] = json?.candidates?.[0]?.content?.parts ?? []
    const text = parts.find((part) => typeof part.text === 'string')?.text
    if (typeof text !== 'string') {
      return { ok: false, reason: `no text part (finish: ${json?.candidates?.[0]?.finishReason ?? 'none'})` }
    }

    return { ok: true, value: JSON.parse(text) as unknown }
  } catch (error) {
    return { ok: false, reason: `${error instanceof Error ? error.name : 'error'}: ${String(error).slice(0, 120)}` }
  }
}
