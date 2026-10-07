import { describe, expect, it } from 'vitest'
import { intensityMix } from '../intensityMix'

describe('intensityMix', () => {
  it('splits time into easy Z1-Z2, moderate Z3 and hard Z4-Z5, in whole percent adding to 100', () => {
    expect(intensityMix({ 1: 600, 2: 4800, 3: 300, 4: 240, 5: 60 })).toMatchObject({
      easySec: 5400, moderateSec: 300, hardSec: 300, totalSec: 6000, easyPct: 90, moderatePct: 5, hardPct: 5, status: 'inRange',
    })
  })

  it('reads too much moderate before too much hard', () => {
    expect(intensityMix({ 2: 70, 3: 20, 4: 10 })!.status).toBe('tooModerate')
    expect(intensityMix({ 2: 70, 3: 5, 4: 25 })!.status).toBe('tooHard')
  })

  // Seiler's 80/20 is a ceiling on hard work, not a quota: an easy week is in range.
  it('never reads too little hard as a caution', () => {
    expect(intensityMix({ 1: 100, 2: 900 })!.status).toBe('inRange')
  })

  it('has nothing to say without zone time', () => {
    expect(intensityMix({})).toBeNull()
    expect(intensityMix({ 2: 0 })).toBeNull()
  })
})
