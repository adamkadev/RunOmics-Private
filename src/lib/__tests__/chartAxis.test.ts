import { describe, expect, it } from 'vitest'
import { roundAxis } from '@/lib/chartAxis'

describe('roundAxis', () => {
  it('snaps the domain outward so every tick is a whole multiple of the step', () => {
    // The Avg Heart Rate axis used to read 146/155/164/173/180 because its
    // domain was pinned to [min - 5, max + 5].
    const axis = roundAxis([146, 158, 163, 168], 5)
    expect(axis).toEqual({ domain: [145, 170], ticks: [145, 150, 155, 160, 165, 170], decimals: 0 })
  })

  it('doubles the step rather than crowding the axis with more than six ticks', () => {
    const axis = roundAxis([146, 180], 5)
    expect(axis).toEqual({ domain: [140, 180], ticks: [140, 150, 160, 170, 180], decimals: 0 })
  })

  it('keeps doubling until the tick count fits, and every tick stays a multiple of the step', () => {
    const axis = roundAxis([100, 300], 5)
    expect(axis!.ticks).toEqual([80, 160, 240, 320])
    expect(axis!.ticks.every((v) => v % 5 === 0)).toBe(true)
  })

  it('lands a clock-formatted pace axis on quarter minutes', () => {
    const axis = roundAxis([262, 268, 275], 15)
    expect(axis).toEqual({ domain: [255, 285], ticks: [255, 270, 285], decimals: 0 })
  })

  it('does not accumulate float error on fractional steps', () => {
    const axis = roundAxis([1.08, 1.21, 1.33], 0.1)
    expect(axis).toEqual({ domain: [1, 1.4], ticks: [1, 1.1, 1.2, 1.3, 1.4], decimals: 1 })
  })

  it('snaps a value that sits exactly on a boundary to that boundary', () => {
    expect(roundAxis([1.2, 1.25], 0.05)!.domain).toEqual([1.2, 1.25])
  })

  it('opens a step either side when every reading is identical', () => {
    expect(roundAxis([160, 160], 5)).toEqual({ domain: [155, 165], ticks: [155, 160, 165], decimals: 0 })
  })

  it('ignores nulls and returns nothing when no reading is left to scale', () => {
    expect(roundAxis([null, 160, undefined], 5)!.domain).toEqual([155, 165])
    expect(roundAxis([null, undefined], 5)).toBeUndefined()
    expect(roundAxis([], 5)).toBeUndefined()
  })

  it('refuses a step that cannot produce ticks', () => {
    expect(roundAxis([1, 2], 0)).toBeUndefined()
    expect(roundAxis([1, 2], Number.NaN)).toBeUndefined()
  })
})
