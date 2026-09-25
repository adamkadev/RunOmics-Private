import { describe, it, expect } from 'vitest'
import type { HrZone } from '../types'
import { plannedEasyHard, recordedEasyHard } from '../easyShare'

function zones(...secondsByZone: number[]): { hrZones: HrZone[] } {
  return {
    hrZones: secondsByZone.map((seconds, i) => ({ zone: i + 1, seconds, percent: 0, minBpm: 0, maxBpm: null })),
  }
}

describe('recordedEasyHard', () => {
  it('reads the time spent in zones 1-2 against the rest', () => {
    // 1 800 s easy, 1 200 s above zone 2, over two runs.
    expect(recordedEasyHard([zones(600, 600), zones(0, 600, 900, 300)])).toEqual({ easy: 60, hard: 40 })
  })

  it('always adds up to 100', () => {
    const split = recordedEasyHard([zones(1000, 1001, 999)])!
    expect(split.easy + split.hard).toBe(100)
  })

  it('has nothing to say about runs with no zone data', () => {
    expect(recordedEasyHard([{ hrZones: [] }])).toBeNull()
  })
})

describe('plannedEasyHard', () => {
  it('weights sessions by their duration', () => {
    // A 90-minute long run and a 30-minute interval session: 75/25, not 50/50.
    expect(plannedEasyHard([{ key: false, seconds: 5_400 }, { key: true, seconds: 1_800 }])).toEqual({ easy: 75, hard: 25 })
  })

  it('has nothing to say about a week with no timed session', () => {
    expect(plannedEasyHard([])).toBeNull()
    expect(plannedEasyHard([{ key: true, seconds: 0 }])).toBeNull()
  })
})
