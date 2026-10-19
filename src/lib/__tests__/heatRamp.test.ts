import { describe, expect, it } from 'vitest'
import { heatRamp } from '@/lib/heatRamp'
import { hexToOklch } from '@/lib/oklch'
import { CURATED_ACCENTS } from '@/lib/accentScale'

describe('the light map heat ramp', () => {
  it('lands on the pair the review named for the default mint', () => {
    const { light, deep } = heatRamp('#2dd4a7')
    expect(light).toBe('#7fd9ba')
    expect(deep).toBe('#0c5e48')
  })

  it('keeps the accent hue at both ends', () => {
    for (const accent of CURATED_ACCENTS) {
      const hue = hexToOklch(accent.light.acc).h
      const { light, deep } = heatRamp(accent.light.acc)
      for (const end of [light, deep]) expect(Math.abs(hexToOklch(end).h - hue)).toBeLessThan(2)
    }
  })

  it('runs soft to deep, whatever the accent', () => {
    for (const accent of CURATED_ACCENTS) {
      const { light, deep } = heatRamp(accent.light.acc)
      expect(hexToOklch(light).l).toBeGreaterThan(hexToOklch(deep).l + 0.3)
      expect(hexToOklch(deep).c).toBeGreaterThan(0.02)
    }
  })
})
