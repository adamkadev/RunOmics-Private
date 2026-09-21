import { describe, it, expect } from 'vitest'
import { gaugePosition, verdictFor } from '../GetLoadBalance'

describe('verdictFor', () => {
  it('grades against the personalised band, bounds inclusive', () => {
    expect(verdictFor(500, 652, 1196)).toBe('below')
    expect(verdictFor(652, 652, 1196)).toBe('onTarget')
    expect(verdictFor(900, 652, 1196)).toBe('onTarget')
    expect(verdictFor(1196, 652, 1196)).toBe('onTarget')
    expect(verdictFor(1300, 652, 1196)).toBe('above')
  })
})

describe('gaugePosition', () => {
  it('maps the target band onto the middle half of the gauge', () => {
    expect(gaugePosition(652, 652, 1196)).toBe(25)
    expect(gaugePosition(924, 652, 1196)).toBe(50)
    expect(gaugePosition(1196, 652, 1196)).toBe(75)
  })

  it('keeps an out-of-range value inside the gauge', () => {
    const wayBelow = gaugePosition(0, 652, 1196)
    const wayAbove = gaugePosition(100_000, 652, 1196)

    expect(wayBelow).toBeGreaterThan(0)
    expect(wayBelow).toBeLessThan(25)
    expect(wayAbove).toBeGreaterThan(75)
    expect(wayAbove).toBeLessThan(100)
  })

  it('compresses rather than clamps, so worse readings still sit further out', () => {
    expect(gaugePosition(400, 652, 1196)).toBeLessThan(gaugePosition(600, 652, 1196))
    expect(gaugePosition(2000, 652, 1196)).toBeGreaterThan(gaugePosition(1300, 652, 1196))
  })

  it('centres a degenerate band instead of dividing by zero', () => {
    expect(gaugePosition(500, 800, 800)).toBe(50)
  })

  it('places the real anaerobic reading well below its band', () => {
    expect(gaugePosition(26, 326, 652)).toBeLessThan(15)
  })
})
