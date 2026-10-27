import 'server-only'
import { dailyBudget, poolOverride, quotaDay, spacingMs, spendField } from '@/domain/ai/budget'
import { getSpend, recordSpend } from '@/infrastructure/repositories/FirestoreBudgetRepository'
import { CALL_TIMEOUT_MS } from '@/lib/gemini'

const RUN_BUDGET_MS = 280_000

const CALL_COST_MS = CALL_TIMEOUT_MS + 3_000

export interface Spender {
  reserve(pool: string[]): Promise<string | null>
  /** A model Google answered 429 or 404, with that answer. */
  exhaust(model: string, reason: string): void
  report(): Record<string, number>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function openSpender(now = new Date()): Promise<Spender> {
  const day = quotaDay(now)
  const spent = { ...(await getSpend(day)) }
  const deadline = Date.now() + RUN_BUDGET_MS
  const lastCallAt: Record<string, number> = {}
  const exhausted = new Set<string>()

  function waitFor(model: string, from: number): number {
    const previous = lastCallAt[spendField(model)]
    return previous ? Math.max(0, spacingMs(model) - (from - previous)) : 0
  }

  return {
    async reserve(pool) {
      const now = Date.now()
      const override = poolOverride(pool, process.env)
      const candidates = (override ? [override] : pool)
        .filter((model) => {
          const field = spendField(model)
          return !exhausted.has(field) && (spent[field] ?? 0) < dailyBudget(model)
        })
        .map((model) => ({ model, wait: waitFor(model, now) }))

      if (!candidates.length) return null

      const chosen = candidates.find((c) => c.wait === 0) ?? candidates.reduce((a, b) => (b.wait < a.wait ? b : a))
      if (now + chosen.wait + CALL_COST_MS > deadline) return null
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
