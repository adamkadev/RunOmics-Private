import { describe, it, expect } from 'vitest'
import { riegel, bestSourceFromMap } from '../riegel'

describe('riegel', () => {
  it('predicts a slower time over a longer distance', () => {
    expect(riegel(1200, 5, 10)).toBeGreaterThan(2400)
  })

  it('is a no-op when target equals source distance', () => {
    expect(riegel(1200, 5, 5)).toBe(1200)
  })
})

describe('bestSourceFromMap', () => {
  const KM_BY_KEY = { '5k': 5, '10k': 10, marathon: 42.195 }

  it('picks the closest known distance by log-ratio, excluding the target itself', () => {
    const bestByKey = new Map([['5k', 1200], ['marathon', 12600], ['10k', 2500]])
    const result = bestSourceFromMap(bestByKey, '10k', KM_BY_KEY, 10)
    expect(result?.sourceKm).toBe(5)
  })

  it('null with an empty map', () => {
    expect(bestSourceFromMap(new Map(), '10k', KM_BY_KEY, 10)).toBeNull()
  })

  it('ignores keys not present in kmByKey', () => {
    const bestByKey = new Map([['unknown', 999]])
    expect(bestSourceFromMap(bestByKey, '10k', KM_BY_KEY, 10)).toBeNull()
  })
})
