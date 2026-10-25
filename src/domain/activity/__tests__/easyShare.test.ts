import { describe, it, expect } from 'vitest'
import type { HrZone } from '../types'
import { easyShare } from '../easyShare'

function zones(...secondsByZone: number[]): { hrZones: HrZone[] } {
  return {
    hrZones: secondsByZone.map((seconds, i) => ({ zone: i + 1, seconds, percent: 0, minBpm: 0, maxBpm: null })),
  }
}

describe('easyShare', () => {
  it('reads the time spent in zones 1-2 against the rest', () => {
    // 1 800 s easy, 1 200 s above zone 2, over two runs.
    expect(easyShare([zones(600, 600), zones(0, 600, 900, 300)])).toEqual({ easy: 60, hard: 40 })
  })

  it("reads a list row's seconds by zone as it reads the zones themselves", () => {
    expect(easyShare([{ zones: [600, 600] }, { zones: [0, 600, 900, 300] }])).toEqual({ easy: 60, hard: 40 })
  })

  it('always adds up to 100', () => {
    const split = easyShare([zones(1000, 1001, 999)])!
    expect(split.easy + split.hard).toBe(100)
  })

  it('has nothing to say about runs with no zone data', () => {
    expect(easyShare([{ hrZones: [] }])).toBeNull()
    expect(easyShare([])).toBeNull()
  })

  it('counts a session still to run at its type zone for its planned time', () => {
    // A 90-minute base run and a 30-minute VO2max session: 75/25, not 50/50.
    expect(easyShare([{ type: 'Base', seconds: 5_400 }, { type: 'VO2Max', seconds: 1_800 }])).toEqual({ easy: 75, hard: 25 })
  })

  it('pools recorded and planned time in one week', () => {
    expect(easyShare([zones(1_800, 0, 1_800), { type: 'Base', seconds: 3_600 }])).toEqual({ easy: 75, hard: 25 })
  })

  it('weights by time, so a long month counts for more than a short one', () => {
    expect(easyShare([zones(9_000, 0, 1_000), zones(0, 0, 1_000)])).toEqual({ easy: 82, hard: 18 })
  })
})
