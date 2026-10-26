import { describe, expect, it } from 'vitest'
import { localLoadPairs } from '../loadTrend'

const days = (loads: number[]) => new Map(loads.map((load, i) => [new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), { load }]))

describe('localLoadPairs', () => {
  it("reads acute as the last 7 days' load and chronic as the last 28 days' weekly average", () => {
    const pairs = localLoadPairs(days(Array.from({ length: 35 }, (_, i) => (i % 2 === 0 ? 70 : 0))))

    expect(pairs.at(-1)).toEqual({ date: '2026-11-04', acute: 280, chronic: 245 })
  })

  it('starts on the first day with load behind it', () => {
    const pairs = localLoadPairs(days([0, 0, 50, 0]))

    expect(pairs.map((p) => p.date)).toEqual(['2026-10-03', '2026-10-04'])
    expect(pairs[0]).toEqual({ date: '2026-10-03', acute: 50, chronic: 13 })
  })
})
