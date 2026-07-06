import { describe, it, expect } from 'vitest'
import { heatAdjustmentSecondsPerKm, shouldAnnotateHeat } from '../heatAdjustment'

describe('heatAdjustmentSecondsPerKm', () => {
  it('zero at or below the baseline temperature', () => {
    expect(heatAdjustmentSecondsPerKm(300, 15)).toBe(0)
    expect(heatAdjustmentSecondsPerKm(300, 5)).toBe(0)
  })

  it('scales with degrees above baseline and with pace', () => {
    const mild = heatAdjustmentSecondsPerKm(300, 25)
    const hot = heatAdjustmentSecondsPerKm(300, 32)
    expect(hot).toBeGreaterThan(mild)
    expect(mild).toBeGreaterThan(0)
  })

  it('a slower base pace produces a larger absolute adjustment', () => {
    const fast = heatAdjustmentSecondsPerKm(240, 30)
    const slow = heatAdjustmentSecondsPerKm(360, 30)
    expect(slow).toBeGreaterThan(fast)
  })
})

describe('shouldAnnotateHeat', () => {
  it('false below the threshold, null, or undefined', () => {
    expect(shouldAnnotateHeat(20)).toBe(false)
    expect(shouldAnnotateHeat(null)).toBe(false)
    expect(shouldAnnotateHeat(undefined)).toBe(false)
  })

  it('true at or above the threshold', () => {
    expect(shouldAnnotateHeat(25)).toBe(true)
    expect(shouldAnnotateHeat(32)).toBe(true)
  })
})
