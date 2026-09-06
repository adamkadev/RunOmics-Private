export interface ModelLimits {
  rpm: number
  rpd: number
}

export const MODEL_LIMITS: Record<string, ModelLimits> = {
  'gemini-3.6-flash': { rpm: 5, rpd: 20 },
  'gemini-3.5-flash': { rpm: 5, rpd: 20 },
  'gemini-3-flash-preview': { rpm: 5, rpd: 20 },
}

const UNKNOWN_MODEL_LIMITS: ModelLimits = { rpm: 5, rpd: 20 }

export const MODEL_POOL = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview']

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
