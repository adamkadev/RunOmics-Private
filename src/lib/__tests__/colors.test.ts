import { describe, expect, it } from 'vitest'
import { RUN_TYPE_ZONE, runTypeColor } from '@/lib/colors'
import { hexToOklch } from '@/lib/oklch'

function deltaE(a: string, b: string): number {
  const lab = (hex: string) => {
    const { l, c, h } = hexToOklch(hex)
    return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]
  }
  const [x, y] = [lab(a), lab(b)]
  return 100 * Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!)
}

describe('RUN_TYPE_ZONE', () => {
  it('maps each run type to the zone it targets', () => {
    expect(RUN_TYPE_ZONE).toEqual({ Sprint: 5, Anaerobic: 5, VO2Max: 5, Threshold: 4, Tempo: 3, Base: 2, Race: 5 })
  })

  it('draws a type in its zone token', () => {
    expect(runTypeColor('Threshold')).toBe('var(--zone-4)')
    expect(runTypeColor('Tempo')).toBe('var(--zone-3)')
  })

  it('draws a type it does not know as Base', () => {
    expect(runTypeColor('HillRepeats')).toBe('var(--zone-2)')
    expect(runTypeColor(undefined)).toBe('var(--zone-2)')
  })
})

/** Every delta, chip and bar the app calls good reads --pos, so this is the one place the rule can be held. */
describe('the status colours (3.0 override 2)', () => {
  it('calls good a green of its own, apart from every accent and the zones', async () => {
    const { STATUS_HEX, ZONE_HEX } = await import('@/lib/themeTokens')
    const { CURATED_ACCENTS } = await import('@/lib/accentScale')
    for (const mode of ['dark', 'light'] as const) {
      for (const accent of CURATED_ACCENTS) expect(deltaE(STATUS_HEX[mode].pos, accent[mode].acc), `${mode} ${accent.id}`).toBeGreaterThanOrEqual(7)
      for (const zone of ZONE_HEX[mode]) expect(deltaE(STATUS_HEX[mode].pos, zone), `${mode} ${zone}`).toBeGreaterThanOrEqual(7)
    }
  })

  it('keeps Z4 and Z5 apart from the heather accent', async () => {
    const { ZONE_HEX } = await import('@/lib/themeTokens')
    const { curatedAccent } = await import('@/lib/accentScale')
    for (const [mode, floor] of [['dark', 18], ['light', 13]] as const) {
      for (const zone of ZONE_HEX[mode].slice(3)) expect(deltaE(zone, curatedAccent('heather')[mode].acc), `${mode} ${zone}`).toBeGreaterThanOrEqual(floor)
    }
  })

  it('draws moderate in a grey-blue apart from the easy blue and the hard purple, and marks it at 3:1 on a card', async () => {
    const { SURFACES, ZONE_HEX, ZONE_MODERATE_HEX } = await import('@/lib/themeTokens')
    const { contrastRatio } = await import('@/lib/oklch')
    for (const mode of ['dark', 'light'] as const) {
      const moderate = ZONE_MODERATE_HEX[mode]
      expect(hexToOklch(moderate).c, mode).toBeLessThan(0.05)
      expect(deltaE(moderate, ZONE_HEX[mode][1]), `${mode} Z2`).toBeGreaterThanOrEqual(11)
      for (const zone of ZONE_HEX[mode].slice(3)) expect(deltaE(moderate, zone), `${mode} ${zone}`).toBeGreaterThanOrEqual(18)
      expect(contrastRatio(moderate, SURFACES[mode].card)).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps warning amber and bad coral', async () => {
    const { STATUS_HEX } = await import('@/lib/themeTokens')
    expect(STATUS_HEX.dark.warn).toBe('#f0b73c')
    expect(STATUS_HEX.dark.neg).toBe('#ff8a80')
  })
})
