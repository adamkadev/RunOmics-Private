import { describe, expect, it } from 'vitest'
import {
  BACKFILL_POOL,
  MODEL_LIMITS,
  MODEL_POOL,
  dailyBudget,
  modelLimits,
  quotaDay,
  spacingMs,
  spendField,
} from '../budget'

const SURFACE_CALLS_PER_NIGHT = 14

const FULL_BACKFILL_VERDICTS = 100

function budgetLosingOneModel(pool: string[]): number {
  const budgets = pool.map(dailyBudget)
  return budgets.reduce((sum, budget) => sum + budget, 0) - Math.max(...budgets)
}

describe('budget', () => {
  it('keeps a reserve under the free-tier ceiling', () => {
    expect(dailyBudget('gemini-3.6-flash')).toBeLessThan(modelLimits('gemini-3.6-flash').rpd)
  })

  it('treats an unknown model as the most constrained one, never as unlimited', () => {
    expect(dailyBudget('some-future-model')).toBe(dailyBudget('gemini-3.6-flash'))
  })

  it('paces an unknown model as tightly as the most constrained one', () => {
    expect(spacingMs('some-future-model')).toBe(spacingMs('gemini-3.6-flash'))
  })

  it('paces slower than the rate limit itself', () => {
    expect(spacingMs('gemini-3.6-flash')).toBeGreaterThan(60_000 / modelLimits('gemini-3.6-flash').rpm)
  })

  it('counts the quota day in Google reset zone, not UTC', () => {
    expect(quotaDay(new Date('2026-07-30T00:30:00Z'))).toBe('2026-07-29')
    expect(quotaDay(new Date('2026-07-30T08:30:00Z'))).toBe('2026-07-30')
  })

  it('flattens the dots Firestore would read as a field path', () => {
    expect(spendField('gemini-3.6-flash')).toBe('gemini-3_6-flash')
  })

  it('only pools models whose limits are known, so none of them is guessed', () => {
    for (const model of [...MODEL_POOL, ...BACKFILL_POOL]) {
      expect(MODEL_LIMITS[model], model).toBeDefined()
    }
  })

  it('spreads the pool over several models, which is where the extra budget is', () => {
    const poolBudget = MODEL_POOL.reduce((sum, model) => sum + dailyBudget(model), 0)
    expect(poolBudget).toBeGreaterThan(dailyBudget(MODEL_POOL[0]!))
  })

  it('keeps the backfill off the pool the read surfaces draw from', () => {
    expect(BACKFILL_POOL.filter((model) => MODEL_POOL.includes(model))).toEqual([])
  })

  it('carries two worst nights of read surfaces, and one with another model retired', () => {
    const poolBudget = MODEL_POOL.reduce((sum, model) => sum + dailyBudget(model), 0)
    expect(poolBudget).toBeGreaterThanOrEqual(SURFACE_CALLS_PER_NIGHT * 2)
    expect(budgetLosingOneModel(MODEL_POOL)).toBeGreaterThanOrEqual(SURFACE_CALLS_PER_NIGHT)
  })

  it('pools 3.7 Flash no more: Google answers it with 3.8, which is already in the pool', () => {
    expect(MODEL_POOL).not.toContain('gemini-3.7-flash')
    expect(new Set(MODEL_POOL).size).toBe(MODEL_POOL.length)
  })

  it('clears a wholly invalidated history in one night even with one model retired', () => {
    expect(budgetLosingOneModel(BACKFILL_POOL)).toBeGreaterThanOrEqual(FULL_BACKFILL_VERDICTS)
  })

  it('paces the backfill faster than the read surfaces, since its rate limit is higher', () => {
    for (const model of BACKFILL_POOL) {
      expect(spacingMs(model), model).toBeLessThan(spacingMs(MODEL_POOL[0]!))
    }
  })
})
