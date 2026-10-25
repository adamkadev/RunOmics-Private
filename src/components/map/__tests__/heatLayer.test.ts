import { describe, expect, it } from 'vitest'
import { heatScale, tracksWithin } from '../heatLayer'

const track = (...points: number[]) => Float64Array.from(points)

describe('the heat layer', () => {
  it('strokes only the tracks that reach the canvas', () => {
    const inside = track(0.5, 0.5, 0.51, 0.51)
    const outside = track(0.8, 0.8, 0.81, 0.81)
    const crossing = track(0.4, 0.5, NaN, NaN, 0.6, 0.55)
    expect(tracksWithin([inside, outside, crossing], 0.45, 0.45, 0.55, 0.6)).toEqual([inside, crossing])
  })

  it('draws at no more than twice the screen points on a 3x iPhone', () => {
    expect(heatScale(603, 1050, 3)).toBe(2)
    expect(heatScale(603, 1050, 1)).toBe(1)
  })
})
