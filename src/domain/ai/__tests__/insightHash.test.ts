import { describe, expect, it } from 'vitest'
import { insightHash } from '../insightHash'

describe('insightHash', () => {
  it('ignores key order so reordering an object literal does not burn API quota', () => {
    expect(insightHash({ tone: 'go', form: 4 })).toBe(insightHash({ form: 4, tone: 'go' }))
  })

  it('changes when a value changes', () => {
    expect(insightHash({ tone: 'go', form: 4 })).not.toBe(insightHash({ tone: 'go', form: 5 }))
  })

  it('distinguishes null from the string "null"', () => {
    expect(insightHash({ planned: null })).not.toBe(insightHash({ planned: 'rest' }))
  })
})
