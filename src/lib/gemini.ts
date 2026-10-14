import 'server-only'
import type { Limits } from '@/domain/ai/prompt'
import { activeLocale } from '@/i18n'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
/**
 * 3.8 Flash thinks for longer than the models before it, even at 'low', and
 * its calls ran into a 30 s limit (Oct 2026); 45 s still leaves a 280 s pass
 * room for a fallback model after a call that times out.
 */
export const CALL_TIMEOUT_MS = 45_000

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

/**
 * One request per call. The insight pass walks a model pool after reserving
 * one request of a model's daily budget - 20 on the flash tier - so the pool is
 * the retry. Retrying in here as well sent up to three requests against that
 * one reservation, and could hold a single call for 95 s of a 300 s function.
 */
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
  }, wait, 0)
  if (!result.ok) return result

  try {
    return parseInsight(result.value, request.limits, request.bulletCount)
  } catch (error) {
    return { ok: false, reason: `parse error: ${String(error).slice(0, 120)}` }
  }
}

/**
 * Google answers a share of perfectly valid calls with 503 "high demand" -
 * measured at roughly one in six against a model that was otherwise serving
 * fine. A single attempt therefore fails a nightly insight or a whole
 * coaching bootstrap on a coin toss.
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
const RETRY_DELAYS_MS = [1_000, 4_000]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function generateStructuredJson(
  request: StructuredRequest,
  sleep: (ms: number) => Promise<unknown> = wait,
  retries = RETRY_DELAYS_MS.length,
): Promise<StructuredResult<unknown>> {
  for (let attempt = 0; ; attempt++) {
    const { result, retryable } = await attemptStructuredJson(request)
    if (result.ok || !retryable || attempt >= retries) return result

    await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!)
  }
}

/** `retryable` stays out of StructuredResult: it is the loop's business, not the caller's. */
interface Attempt {
  result: StructuredResult<unknown>
  retryable: boolean
}

/** "gemini-3.8-flash" is 3.8, "gemini-3-flash-preview" 3.0; null for a name that carries none. */
function modelVersion(model: string): { major: number; minor: number } | null {
  const version = model.match(/^gemini-(\d+)(?:\.(\d+))?-/)
  return version ? { major: Number(version[1]), minor: Number(version[2] ?? 0) } : null
}

/**
 * Gemini 3.8 Flash and later take no sampling settings - temperature, top_p
 * and top_k are deprecated there, its thinking level and the response
 * schema steer it instead (Google's 3.8 Flash migration notes) - so only an
 * older model is sent one.
 */
export function takesTemperature(model: string): boolean {
  const version = modelVersion(model)
  if (!version) return true
  return version.major < 3 || (version.major === 3 && version.minor < 8)
}

/**
 * How much the model thinks before it answers. Gemini 3.x is set by level,
 * 'low' its floor; 2.x by a token budget, and 512 is about what 'low' spends
 * on these answers (Oct 2026: 2.5 Flash joined the pool as a fallback).
 */
export function thinkingConfig(model: string): { thinkingLevel: 'low' } | { thinkingBudget: number } {
  const version = modelVersion(model)
  return version && version.major < 3 ? { thinkingBudget: 512 } : { thinkingLevel: 'low' }
}

async function attemptStructuredJson(request: StructuredRequest): Promise<Attempt> {
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
          ...(takesTemperature(request.model) ? { temperature: request.temperature ?? 0.4 } : {}),
          thinkingConfig: thinkingConfig(request.model),
        },
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    })

    if (!res.ok) {
      return {
        result: { ok: false, reason: `http ${res.status}: ${(await res.text()).slice(0, 200)}` },
        retryable: RETRYABLE_STATUS.has(res.status),
      }
    }

    const json = await res.json()
    const parts: { text?: unknown }[] = json?.candidates?.[0]?.content?.parts ?? []
    const text = parts.find((part) => typeof part.text === 'string')?.text
    if (typeof text !== 'string') {
      const finish = json?.candidates?.[0]?.finishReason ?? 'none'
      return { result: { ok: false, reason: `no text part (finish: ${finish})` }, retryable: false }
    }

    return { result: { ok: true, value: JSON.parse(text) as unknown }, retryable: false }
  } catch (error) {
    // A timeout or a dropped connection is the same kind of luck as a 503.
    const reason = `${error instanceof Error ? error.name : 'error'}: ${String(error).slice(0, 120)}`
    return { result: { ok: false, reason }, retryable: true }
  }
}
