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
 * Newest first. Not 3.7 Flash: Google answers it with 3.8 Flash, so it would ask 3.8 twice on 3.8's quota.
 * 3 Flash has a free quota of its own, for days Google answers the others with nothing but 503s.
 * Not 2.5 Flash: Google serves it only to accounts that used it before, and answers others with a 404.
 */
export const MODEL_POOL = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3-flash-preview']

// 3.5 Flash-Lite, Google's named replacement for 3.1 Flash-Lite (shut down from May 7, 2027), leads.
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
