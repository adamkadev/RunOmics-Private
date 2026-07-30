import { describe, expect, it } from 'vitest'
import { HERO_POOL, MODEL_LIMITS, SUPPORTING_POOL, dailyBudget, modelLimits, quotaDay, spacingMs, spendField } from '../budget'

describe('budget', () => {
  it('keeps a reserve under the free-tier ceiling', () => {
    expect(dailyBudget('gemini-3.6-flash')).toBeLessThan(modelLimits('gemini-3.6-flash').rpd)
  })

  it('treats an unknown model as the most constrained one, never as unlimited', () => {
    expect(dailyBudget('some-future-model')).toBe(dailyBudget('gemini-3.6-flash'))
  })

  it('spaces calls further apart on the model with the lower rate limit', () => {
    expect(spacingMs('gemini-3.6-flash')).toBeGreaterThan(spacingMs('gemini-3.5-flash-lite'))
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
    for (const model of [...HERO_POOL, ...SUPPORTING_POOL]) {
      expect(MODEL_LIMITS[model], model).toBeDefined()
    }
  })

  it('spreads a tier over several models, which is where the extra budget is', () => {
    const heroBudget = HERO_POOL.reduce((sum, model) => sum + dailyBudget(model), 0)
    expect(heroBudget).toBeGreaterThan(dailyBudget(HERO_POOL[0]!) * 3)
  })
})
