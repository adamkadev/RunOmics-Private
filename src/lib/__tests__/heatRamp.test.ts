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

  // The white accent has no hue to ramp (3.0 override 9), so it is the one
  // that takes a graphite ramp instead.
  const HUED = CURATED_ACCENTS.filter((accent) => accent.id !== 'mono')

  it('keeps the accent hue at both ends', () => {
    for (const accent of HUED) {
      const hue = hexToOklch(accent.light.acc).h
      const { light, deep } = heatRamp(accent.light.acc)
      for (const end of [light, deep]) expect(Math.abs(hexToOklch(end).h - hue)).toBeLessThan(2)
    }
  })

  it('runs soft to deep, whatever the accent', () => {
    for (const accent of CURATED_ACCENTS) {
      const { light, deep } = heatRamp(accent.light.acc)
      expect(hexToOklch(light).l).toBeGreaterThan(hexToOklch(deep).l + 0.3)
    }
    for (const accent of HUED) expect(hexToOklch(heatRamp(accent.light.acc).deep).c).toBeGreaterThan(0.02)
  })

  it('ramps the white accent in graphite, not in whatever hue the rounding left', () => {
    const mono = CURATED_ACCENTS.find((accent) => accent.id === 'mono')!
    for (const acc of [mono.light.acc, mono.dark.acc]) {
      const { light, deep } = heatRamp(acc)
      expect(hexToOklch(light).c).toBeLessThan(0.02)
      expect(hexToOklch(deep).c).toBeLessThan(0.02)
    }
  })
})
