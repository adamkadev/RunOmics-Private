import { describe, it, expect } from 'vitest'
import { en } from '../en'

describe('trainingStatus.metrics.tsbHint', () => {
  const { tsbHint } = en.trainingStatus.metrics

  it('never claims "race ready" when undertrained (recovery/detraining), even at high TSB', () => {
    expect(tsbHint(34, 'recovery')).not.toMatch(/race ready/i)
    expect(tsbHint(34, 'detraining')).not.toMatch(/race ready/i)
    expect(tsbHint(20, 'recovery')).not.toMatch(/race ready/i)
  })

  it('reports undertraining explicitly for recovery/detraining at high TSB', () => {
    expect(tsbHint(34, 'recovery')).toMatch(/undertrained/i)
    expect(tsbHint(20, 'detraining')).toMatch(/undertrained/i)
  })

  it('still shows "race ready" for a genuine peak (fresh/productive status)', () => {
    expect(tsbHint(20, 'fresh')).toMatch(/race ready/i)
    expect(tsbHint(15, 'productive')).toMatch(/race ready/i)
  })

  it('leaves fatigued ranges (tsb < 0) unaffected by status', () => {
    expect(tsbHint(-5, 'recovery')).toBe(tsbHint(-5, 'productive'))
    expect(tsbHint(-25, 'overreaching')).toMatch(/rest needed/i)
  })
})
