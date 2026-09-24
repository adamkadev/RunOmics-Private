import { describe, expect, it } from 'vitest'
import { hrBoundsFor } from '../hrBounds'
import { DEFAULT_HR_BOUNDS } from '../trimp'

describe('hrBoundsFor', () => {
  it("uses the athlete's own bounds", () => {
    expect(hrBoundsFor({ maxHrBpm: 189, restingHrBpm: 50 })).toEqual({ maxHr: 189, restingHr: 50 })
  })

  // /plan used to drop to both defaults here, while the training load kept
  // the 189: one athlete, two weekly loads.
  it('keeps a known value when only the other one is missing', () => {
    expect(hrBoundsFor({ maxHrBpm: 189 })).toEqual({ maxHr: 189, restingHr: DEFAULT_HR_BOUNDS.restingHr })
    expect(hrBoundsFor({ restingHrBpm: 50 })).toEqual({ maxHr: DEFAULT_HR_BOUNDS.maxHr, restingHr: 50 })
  })

  it('falls back to the defaults for an athlete with neither', () => {
    expect(hrBoundsFor({})).toEqual(DEFAULT_HR_BOUNDS)
  })
})
