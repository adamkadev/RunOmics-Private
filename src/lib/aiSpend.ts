import { dailyBudget, quotaDay, spacingMs, spendField } from '@/domain/ai/budget'
import { getSpend, recordSpend } from '@/infrastructure/repositories/FirestoreBudgetRepository'

// A serverless invocation is capped at 60s, and pacing a run of flash calls
// costs 13s each, so a batch has to be able to stop mid-way. Every surface is
// keyed by a hash of its own facts, so whatever this run does not reach is
// simply picked up by the next one.
const RUN_BUDGET_MS = 45_000

export interface Spender {
  /**
   * Claims one request for `model`, waiting out the per-minute spacing first.
   * False means the daily ceiling, the run's time budget or a 429 already
   * closed the door - the caller must not call Gemini.
   */
  reserve(model: string): Promise<boolean>
  /** Marks a model as done for this run, after the API itself said 429. */
  exhaust(model: string): void
  report(): Record<string, number>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The one place that decides whether a Gemini call may happen. Spend is
 * reserved before the request and counted whatever the outcome: a 429, a
 * timeout and a rejected candidate all consume the same quota as a usable
 * answer, so counting on success only would drift under the real usage.
 */
export async function openSpender(now = new Date()): Promise<Spender> {
  const day = quotaDay(now)
  const spent = { ...(await getSpend(day)) }
  const deadline = Date.now() + RUN_BUDGET_MS
  const lastCallAt: Record<string, number> = {}
  const exhausted = new Set<string>()

  return {
    async reserve(model) {
      const field = spendField(model)
      if (exhausted.has(field)) return false
      if ((spent[field] ?? 0) >= dailyBudget(model)) return false

      const previous = lastCallAt[field]
      const wait = previous ? Math.max(0, spacingMs(model) - (Date.now() - previous)) : 0
      if (Date.now() + wait > deadline) return false
      if (wait > 0) await sleep(wait)

      spent[field] = (spent[field] ?? 0) + 1
      lastCallAt[field] = Date.now()
      await recordSpend(day, model)
      return true
    },

    exhaust(model) {
      exhausted.add(spendField(model))
    },

    report() {
      return { ...spent }
    },
  }
}
