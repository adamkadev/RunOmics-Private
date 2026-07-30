export interface ModelLimits {
  /** Requests per minute. */
  rpm: number
  /** Requests per day. */
  rpd: number
}

// The free-tier ceilings, per model. An unlisted model is treated as the most
// constrained one rather than as unlimited: swapping models through
// GEMINI_MODEL must never widen the budget by accident.
export const MODEL_LIMITS: Record<string, ModelLimits> = {
  'gemini-3.6-flash': { rpm: 5, rpd: 20 },
  'gemini-3.6-flash-lite': { rpm: 15, rpd: 500 },
}

const UNKNOWN_MODEL_LIMITS: ModelLimits = { rpm: 5, rpd: 20 }

// Surface tiering. The copy an athlete reads every day gets the stronger model;
// supporting copy runs on the lite one, which is what keeps the 20/day pool
// free for the run verdicts rather than spending it on a shoe card.
export const HERO_MODEL = 'gemini-3.6-flash'
export const SUPPORTING_MODEL = 'gemini-3.6-flash-lite'

// Requests held back from the daily ceiling so a manual backfill, or a retry
// after a failed cron, never lands on an already exhausted quota.
const RESERVE = 2

// Google resets the daily quota at midnight Pacific, not UTC. Counting spend
// per UTC day would zero the ledger at 16:00 Pacific and let a second day's
// worth of calls through on one of Google's days.
const QUOTA_TIME_ZONE = 'America/Los_Angeles'

export function modelLimits(model: string): ModelLimits {
  return MODEL_LIMITS[model] ?? UNKNOWN_MODEL_LIMITS
}

export function dailyBudget(model: string): number {
  return Math.max(0, modelLimits(model).rpd - RESERVE)
}

// Gemini counts the minute as a sliding window, so pacing at exactly 60/rpm
// still trips the limit when the tail of a previous run overlaps.
export function spacingMs(model: string): number {
  return Math.ceil(60_000 / modelLimits(model).rpm) + 1_000
}

/** The day the quota is counted against, as YYYY-MM-DD in Google's own zone. */
export function quotaDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: QUOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// Firestore parses dots in a field path as separators, and every model name has
// one, so the ledger stores them flattened.
export function spendField(model: string): string {
  return model.replaceAll('.', '_')
}
