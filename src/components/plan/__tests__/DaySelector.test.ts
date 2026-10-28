import { describe, expect, it } from 'vitest'
import { barHeight, weekPxPerKm } from '../DaySelector'

const run = (km: number | null) => ({ state: 'planned' as const, km })
const rest = { state: 'rest' as const, km: null }

describe('the day bars', () => {
  it('fill the track with the longest run of a week of short runs', () => {
    const days = [rest, run(4), rest, run(4), rest, run(3), rest]
    const scale = weekPxPerKm(days)

    expect(barHeight(run(4), scale)).toBe(68)
    expect(barHeight(run(3), scale)).toBe(51)
  })

  it('keep the shared scale in a week with a long run', () => {
    const days = [run(8), rest, run(10), rest, run(16)]

    expect(weekPxPerKm(days)).toBe(5)
    expect(barHeight(run(10), weekPxPerKm(days))).toBe(50)
  })

  it('keep the shared scale in a week with no distance', () => {
    expect(weekPxPerKm([rest, run(null), rest])).toBe(5)
    expect(barHeight(run(null), weekPxPerKm([run(null)]))).toBe(14)
  })

  it('leave a rest day a stub whatever the scale', () => {
    expect(barHeight(rest, 17)).toBe(5)
  })
})
