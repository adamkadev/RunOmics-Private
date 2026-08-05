import { describe, expect, it } from 'vitest'
import { MODEL_LIMITS, MODEL_POOL, dailyBudget, modelLimits, quotaDay, spacingMs, spendField } from '../budget'

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
    // 00:30 UTC is still the previous afternoon in Pacific time, and Google has
    // not reset the counter yet.
    expect(quotaDay(new Date('2026-07-30T00:30:00Z'))).toBe('2026-07-29')
    expect(quotaDay(new Date('2026-07-30T08:30:00Z'))).toBe('2026-07-30')
  })

  it('flattens the dots Firestore would read as a field path', () => {
    expect(spendField('gemini-3.6-flash')).toBe('gemini-3_6-flash')
  })

  it('only pools models whose limits are known, so none of them is guessed', () => {
    for (const model of MODEL_POOL) {
      expect(MODEL_LIMITS[model], model).toBeDefined()
    }
  })

  it('spreads the pool over several models, which is where the extra budget is', () => {
    const poolBudget = MODEL_POOL.reduce((sum, model) => sum + dailyBudget(model), 0)
    expect(poolBudget).toBeGreaterThan(dailyBudget(MODEL_POOL[0]!))
  })
})
