import { describe, it, expect } from 'vitest'
import { newlyComplete } from '../GetExploreGains'

const BRAVO = { id: 'test-bravo', name: 'Bravo', pct: 92 }
const ALPHA = { id: 'test-alpha', name: 'Alpha', pct: 90 }

describe('newlyComplete', () => {
  it('announces nothing on the first check, which only takes note', () => {
    expect(newlyComplete([BRAVO], null)).toEqual([])
  })

  it('announces the quartiers complete since the last check', () => {
    expect(newlyComplete([BRAVO, ALPHA], { announced: ['test-bravo'] })).toEqual([ALPHA])
    expect(newlyComplete([BRAVO], { announced: ['test-bravo'] })).toEqual([])
  })
})
