export interface ModelLimits {
  rpm: number
  rpd: number
}

export const MODEL_LIMITS: Record<string, ModelLimits> = {
  'gemini-3.8-flash': { rpm: 5, rpd: 20 },
  'gemini-3.6-flash': { rpm: 5, rpd: 20 },
  'gemini-3-flash-preview': { rpm: 5, rpd: 20 },
  'gemini-3.5-flash-lite': { rpm: 15, rpd: 500 },
  'gemini-3.1-flash-lite': { rpm: 15, rpd: 500 },
}

const UNKNOWN_MODEL_LIMITS: ModelLimits = { rpm: 5, rpd: 20 }

/**
 * Newest first. Gemini 3.7 Flash is gone (Oct 2026): Google answers it with
 * 3.8 Flash. Kept in the pool it was 3.8 asked twice - paced and budgeted as
 * if it were another model, so the second ask came inside 3.8's minute and
 * drew on its day - and Google reports both as 503 "high demand".
 *
 * 3 Flash, with a free quota of its own (AI Studio's rate limits, Oct 2026),
 * comes after: on days Google answered 3.8 and 3.6 with nothing but 503s, a
 * run's verdict had nowhere else to go. It is a preview with no shutdown date
 * (Gemini deprecations, Oct 12 2026), its named replacement, 3.6 Flash,
 * already ahead of it. 2.5 Flash left again the same week: Google serves it
 * only to accounts that used it before, and answered this one with a 404.
 */
export const MODEL_POOL = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3-flash-preview']

// 3.1 Flash-Lite shuts down on May 7, 2027 at the earliest; 3.5 Flash-Lite,
// the replacement Google names, already leads.
export const BACKFILL_POOL = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']

const RESERVE = 2

const QUOTA_TIME_ZONE = 'America/Los_Angeles'

export function modelLimits(model: string): ModelLimits {
  return MODEL_LIMITS[model] ?? UNKNOWN_MODEL_LIMITS
}

export function dailyBudget(model: string): number {
  return Math.max(0, modelLimits(model).rpd - RESERVE)
}

export function spacingMs(model: string): number {
  return Math.ceil(60_000 / modelLimits(model).rpm) + 1_000
}

export function quotaDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: QUOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function spendField(model: string): string {
  return model.replaceAll('.', '_')
}
