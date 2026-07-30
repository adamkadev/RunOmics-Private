import { describe, expect, it, vi, beforeEach } from 'vitest'
import { dailyBudget, spendField } from '@/domain/ai/budget'

const ledger = vi.hoisted(() => ({ current: {} as Record<string, number> }))

vi.mock('@/infrastructure/repositories/FirestoreBudgetRepository', () => ({
  getSpend: vi.fn(async () => ({ ...ledger.current })),
  recordSpend: vi.fn(async (_day: string, model: string) => {
    const field = model.replaceAll('.', '_')
    ledger.current[field] = (ledger.current[field] ?? 0) + 1
  }),
}))

const { openSpender } = await import('../aiSpend')

const MODEL = 'gemini-3.6-flash'

describe('openSpender', () => {
  beforeEach(() => {
    ledger.current = {}
  })

  it('refuses once the day ceiling is already spent', async () => {
    ledger.current[spendField(MODEL)] = dailyBudget(MODEL)

    const spender = await openSpender()
    expect(await spender.reserve(MODEL)).toBe(false)
  })

  it('counts a reserved call in the ledger before the request is made', async () => {
    const spender = await openSpender()

    expect(await spender.reserve(MODEL)).toBe(true)
    expect(ledger.current[spendField(MODEL)]).toBe(1)
    expect(spender.report()[spendField(MODEL)]).toBe(1)
  })

  it('picks up what earlier runs of the same day already spent', async () => {
    ledger.current[spendField(MODEL)] = dailyBudget(MODEL) - 1

    const spender = await openSpender()
    expect(await spender.reserve(MODEL)).toBe(true)
    expect(await spender.reserve(MODEL)).toBe(false)
  })

  it('stops spending on a model the API answered 429 to', async () => {
    const spender = await openSpender()
    spender.exhaust(MODEL)

    expect(await spender.reserve(MODEL)).toBe(false)
    expect(ledger.current[spendField(MODEL)]).toBeUndefined()
  })

  it('keeps one model budget from eating another', async () => {
    ledger.current[spendField(MODEL)] = dailyBudget(MODEL)

    const spender = await openSpender()
    expect(await spender.reserve(MODEL)).toBe(false)
    expect(await spender.reserve('gemini-3.6-flash-lite')).toBe(true)
  })
})
