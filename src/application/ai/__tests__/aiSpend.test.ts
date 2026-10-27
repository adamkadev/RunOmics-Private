import { describe, expect, it, vi, beforeEach } from 'vitest'
import { BACKFILL_POOL, MODEL_POOL, dailyBudget, spendField } from '@/domain/ai/budget'

const ledger = vi.hoisted(() => ({ current: {} as Record<string, number> }))

vi.mock('@/infrastructure/repositories/FirestoreBudgetRepository', () => ({
  getSpend: vi.fn(async () => ({ ...ledger.current })),
  recordSpend: vi.fn(async (_day: string, model: string) => {
    const field = model.replaceAll('.', '_')
    ledger.current[field] = (ledger.current[field] ?? 0) + 1
  }),
}))

const { openSpender } = await import('../aiSpend')

const [BEST, SECOND] = MODEL_POOL as [string, string]

function fill(model: string) {
  ledger.current[spendField(model)] = dailyBudget(model)
}

describe('openSpender', () => {
  beforeEach(() => {
    ledger.current = {}
  })

  it('takes the best model in the pool first', async () => {
    const spender = await openSpender()
    expect(await spender.reserve(MODEL_POOL)).toBe(BEST)
  })

  it('falls through to the next model once one has spent its day', async () => {
    fill(BEST)

    const spender = await openSpender()
    expect(await spender.reserve(MODEL_POOL)).toBe(SECOND)
  })

  it('refuses only when every model in the pool is spent', async () => {
    MODEL_POOL.forEach(fill)

    const spender = await openSpender()
    expect(await spender.reserve(MODEL_POOL)).toBeNull()
  })

  it('counts a reserved call in the ledger before the request is made', async () => {
    const spender = await openSpender()

    expect(await spender.reserve(MODEL_POOL)).toBe(BEST)
    expect(ledger.current[spendField(BEST)]).toBe(1)
    expect(spender.report()[spendField(BEST)]).toBe(1)
  })

  it('picks up what earlier runs of the same day already spent', async () => {
    ledger.current[spendField(BEST)] = dailyBudget(BEST) - 1

    const spender = await openSpender()
    expect(await spender.reserve([BEST])).toBe(BEST)
    expect(await spender.reserve([BEST])).toBeNull()
  })

  it('stops spending on a model the API refused', async () => {
    const spender = await openSpender()
    spender.exhaust(BEST, 'http 429: quota')

    expect(await spender.reserve(MODEL_POOL)).toBe(SECOND)
    expect(ledger.current[spendField(BEST)]).toBeUndefined()
  })

  it('refuses a call the invocation has no room left to finish', async () => {
    vi.useFakeTimers()
    try {
      const spender = await openSpender()

      vi.advanceTimersByTime(200_000)
      expect(await spender.reserve(MODEL_POOL)).toBe(BEST)

      vi.advanceTimersByTime(60_000)
      expect(await spender.reserve(MODEL_POOL)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps one model budget from eating another', async () => {
    fill(BEST)

    const spender = await openSpender()
    expect(await spender.reserve([BEST])).toBeNull()
    expect(await spender.reserve([SECOND])).toBe(SECOND)
  })

  it('stands GEMINI_MODEL in for the main pool alone, and GEMINI_BACKFILL_MODEL for the backfill pool', async () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-main-override')
    vi.stubEnv('GEMINI_BACKFILL_MODEL', 'gemini-backfill-override')
    try {
      const spender = await openSpender()
      expect(await spender.reserve(MODEL_POOL)).toBe('gemini-main-override')
      expect(await spender.reserve(BACKFILL_POOL)).toBe('gemini-backfill-override')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('leaves the backfill pool alone when only GEMINI_MODEL is set', async () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-main-override')
    vi.stubEnv('GEMINI_BACKFILL_MODEL', '')
    try {
      const spender = await openSpender()
      expect(await spender.reserve(BACKFILL_POOL)).toBe(BACKFILL_POOL[0])
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
