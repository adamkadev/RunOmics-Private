import { describe, it, expect } from 'vitest'
import { ACTIVITY_TYPES, isActivityType } from '../types'

describe('ACTIVITY_TYPES', () => {
  // The order is a contract: the filter chips break ties in it and the type style map is declared in it.
  it('lists every activity type once, hardest effort first', () => {
    expect(ACTIVITY_TYPES).toEqual(['Sprint', 'Anaerobic', 'VO2Max', 'Threshold', 'Tempo', 'Base', 'Race'])
  })
})

describe('isActivityType', () => {
  it('accepts every listed type', () => {
    for (const type of ACTIVITY_TYPES) expect(isActivityType(type), type).toBe(true)
  })

  it('rejects anything else', () => {
    for (const value of ['HillRepeats', 'base', '', null, undefined, 3, {}]) {
      expect(isActivityType(value), String(value)).toBe(false)
    }
  })
})
