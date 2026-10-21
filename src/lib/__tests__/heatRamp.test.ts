import { describe, expect, it } from 'vitest'
import { heatAccent, heatLegendGradient, rampDark, rampLight, type Rgb } from '@/lib/heatRamp'

const near = (actual: Rgb, expected: Rgb) => actual.forEach((v, i) => expect(Math.abs(v - expected[i]!)).toBeLessThanOrEqual(2))

describe('rampLight (App Fixes 4d)', () => {
  const mint = heatAccent('teal')

  it('builds the light ramp from the full mint accent', () => {
    expect(mint).toBe('#2dd4a7')
  })

  it('hits the stops of the mockup legend', () => {
    near(rampLight(mint, 0), [140, 231, 207])
    near(rampLight(mint, 0.4), [45, 212, 167])
    near(rampLight(mint, 0.75), [26, 114, 90])
    near(rampLight(mint, 1), [13, 51, 41])
  })

  it('ramps the white accent in graphite on a light map', () => {
    const mono = heatAccent('mono')
    near(rampLight(mono, 0), [195, 201, 199])
    near(rampLight(mono, 1), [11, 12, 12])
  })
})

describe('rampDark (App Fixes 4d)', () => {
  it('reaches the accent at 0.75 and ends on a light accent, never white (Wave 6)', () => {
    near(rampDark('#2dd4a7', 0.75), [45, 212, 167])
    near(rampDark('#2dd4a7', 1), [98, 223, 189])
    near(rampDark('#5fd4f0', 1), [135, 223, 244])
    near(rampDark(heatAccent('mono'), 1), [233, 236, 234])
  })

  it('starts dim', () => {
    for (const accent of ['#2dd4a7', '#5fd4f0']) expect(Math.max(...rampDark(accent, 0))).toBeLessThan(110)
  })
})

describe('heatLegendGradient', () => {
  it('draws four stops in light and three in dark', () => {
    expect(heatLegendGradient('light', '#2dd4a7').match(/rgb\(/g)).toHaveLength(4)
    expect(heatLegendGradient('dark', '#2dd4a7').match(/rgb\(/g)).toHaveLength(3)
  })
})
