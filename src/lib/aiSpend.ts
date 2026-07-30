import { dailyBudget, quotaDay, spacingMs, spendField } from '@/domain/ai/budget'
import { getSpend, recordSpend } from '@/infrastructure/repositories/FirestoreBudgetRepository'

// A serverless invocation is capped at 60s, and pacing a run of calls on one
// model costs 13s each, so a batch has to be able to stop mid-way. Every
// surface is keyed by a hash of its own facts, so whatever this run does not
// reach is simply picked up by the next one.
const RUN_BUDGET_MS = 45_000

export interface Spender {
  /**
   * Claims one request from `pool`, taking the best model that is free right
   * now and waiting out the per-minute spacing only when none is. Returns the
   * model to call, or null when the daily ceilings, the run's time budget or a
   * 429 closed every door in the pool.
   */
  reserve(pool: string[]): Promise<string | null>
  /** Marks a model as done for this run, after the API refused it. */
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

  // Escape hatch: Google retires models with little warning, so one env var can
  // pin every surface to a single known-good one. It replaces the pool rather
  // than the request, so what gets counted stays what gets called.
  const override = process.env.GEMINI_MODEL

  function waitFor(model: string, from: number): number {
    const previous = lastCallAt[spendField(model)]
    return previous ? Math.max(0, spacingMs(model) - (from - previous)) : 0
  }

  return {
    async reserve(pool) {
      const now = Date.now()
      const candidates = (override ? [override] : pool)
        .filter((model) => {
          const field = spendField(model)
          return !exhausted.has(field) && (spent[field] ?? 0) < dailyBudget(model)
        })
        .map((model) => ({ model, wait: waitFor(model, now) }))

      if (!candidates.length) return null

      // Pool order is quality order, so the first one that owes no wait is both
      // the best available and the fastest; waiting only happens when the whole
      // pool is still inside its per-minute window.
      const chosen = candidates.find((c) => c.wait === 0) ?? candidates.reduce((a, b) => (b.wait < a.wait ? b : a))
      if (now + chosen.wait > deadline) return null
      if (chosen.wait > 0) await sleep(chosen.wait)

      const field = spendField(chosen.model)
      spent[field] = (spent[field] ?? 0) + 1
      lastCallAt[field] = Date.now()
      await recordSpend(day, chosen.model)
      return chosen.model
    },

    exhaust(model) {
      exhausted.add(spendField(model))
    },

    report() {
      return { ...spent }
    },
  }
}
