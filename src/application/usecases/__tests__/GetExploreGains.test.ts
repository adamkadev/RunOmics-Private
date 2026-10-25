import { describe, it, expect } from 'vitest'
import { announcedByArea, newlyComplete } from '../GetExploreGains'

const BRAVO = { id: 'test-bravo', name: 'Bravo', pct: 92, since: '2026-08-09' }
const ALPHA = { id: 'test-alpha', name: 'Alpha', pct: 90, since: '2026-10-21' }

describe('newlyComplete', () => {
  it('announces nothing on the first check of an area, which only takes note', () => {
    expect(newlyComplete([BRAVO], undefined)).toEqual([])
  })

  it('announces the quartiers complete since the last check', () => {
    expect(newlyComplete([BRAVO, ALPHA], ['test-bravo'])).toEqual([ALPHA])
    expect(newlyComplete([BRAVO], ['test-bravo'])).toEqual([])
  })
})

describe('announcedByArea', () => {
  it('reads one list per area, and the one-area shape stored before as its area', () => {
    expect(announcedByArea({ areas: { metz: ['metz-1'], strasbourg: [] } })).toEqual({ metz: ['metz-1'], strasbourg: [] })
    expect(announcedByArea({ areaId: 'metz', announced: ['metz-1'] })).toEqual({ metz: ['metz-1'] })
    expect(announcedByArea(null)).toEqual({})
  })
})
