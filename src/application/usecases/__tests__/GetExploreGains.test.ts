import { describe, it, expect } from 'vitest'
import { newlyComplete } from '../GetExploreGains'

const BRAVO = { id: 'test-bravo', name: 'Bravo', pct: 92 }
const ALPHA = { id: 'test-alpha', name: 'Alpha', pct: 90 }

describe('newlyComplete', () => {
  it('announces nothing on the first check of an area, which only takes note', () => {
    expect(newlyComplete([BRAVO], null, 'test')).toEqual([])
    expect(newlyComplete([BRAVO], { areaId: 'elsewhere', announced: [] }, 'test')).toEqual([])
  })

  it('announces the quartiers complete since the last check', () => {
    expect(newlyComplete([BRAVO, ALPHA], { areaId: 'test', announced: ['test-bravo'] }, 'test')).toEqual([ALPHA])
    expect(newlyComplete([BRAVO], { areaId: 'test', announced: ['test-bravo'] }, 'test')).toEqual([])
  })
})
