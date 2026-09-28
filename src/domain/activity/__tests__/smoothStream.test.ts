import { describe, expect, it } from 'vitest'
import { movingAverage, rollingMedian, smoothStream } from '../smoothStream'

describe('smoothStream (v4.17)', () => {
  it('averages the ±3 samples around each one, fewer at the ends', () => {
    const out = movingAverage([0, 0, 0, 7, 0, 0, 0, 0], 3)
    expect(out[0]).toBe(7 / 4)
    expect(out[3]).toBe(1)
    expect(out[7]).toBe(0)
  })

  it('takes a lone spike out with the rolling median', () => {
    const pace = [300, 300, 300, 300, 300, 300, 420, 300, 300, 300, 300, 300, 300]
    expect(rollingMedian(pace, 6)).toEqual(pace.map(() => 300))
  })

  it('keeps a gap a gap, and averages only the samples a window has', () => {
    expect(movingAverage([10, null, 20], 3)).toEqual([15, null, 15])
    expect(rollingMedian([null, 5], 6)).toEqual([null, 5])
  })

  it('despikes pace before averaging it; the other streams are only averaged', () => {
    const spiky = Array.from({ length: 30 }, (_, i) => (i === 15 ? 600 : 300))
    expect(Math.max(...(smoothStream(spiky, { despike: true }) as number[]))).toBe(300)
    expect(Math.max(...(smoothStream(spiky) as number[]))).toBeGreaterThan(300)
  })
})
