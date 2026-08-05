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
  'gemini-3.5-flash': { rpm: 5, rpd: 20 },
  'gemini-3-flash-preview': { rpm: 5, rpd: 20 },
}

const UNKNOWN_MODEL_LIMITS: ModelLimits = { rpm: 5, rpd: 20 }

// Both quotas are counted per model, which makes a pool more than a fallback
// list. Three flash-class models at 20 a day each is 60 calls of that quality,
// and their per-minute limits are separate too - alternating between them
// removes most of the waiting a single model would owe. Order is quality
// order: the spender always takes the best one that is free right now.
// gemini-2.5-flash used to round out the pool but was retired by Google (404:
// "no longer available to new users", confirmed 2026-08-05) - left in, every
// reserve() that reached it would have burned a reservation and a call for a
// guaranteed failure.
//
// One pool, for every surface. A cheaper tier existed until 2026-07-31 to keep
// the archive backfill off this budget; with the archive written, steady state
// is around a dozen calls a day against these 60, so there is nothing left to
// protect. The lite models also had about a third of their answers rejected for
// dropped French accents (see lib/gemini.ts), which made them expensive in the
// only currency that mattered.
export const MODEL_POOL = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview']

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
