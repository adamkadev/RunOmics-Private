import { describe, expect, it } from 'vitest'
import { contrastRatio, hexToOklch } from '@/lib/oklch'
import { rgbTriplet } from '@/lib/palette'
import { SURFACES, TOKEN_BLOCKS, ZONE_HEX } from '@/lib/themeTokens'

/**
 * Distances are OKLab ΔE ×100; colour-blind vision is simulated after Machado, Oliveira & Fernandes (2009).
 * Z3's violet sits close to its neighbours for a red-green colour-blind eye, so the share card names each zone.
 */
const NORMAL_MIN = 9
const CVD_FLOOR = 2.5

type Matrix = readonly [readonly number[], readonly number[], readonly number[]]
const PROTAN: Matrix = [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]
const DEUTAN: Matrix = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]]

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function simulate(hex: string, m: Matrix): string {
  const lin = rgbTriplet(hex).map((v) => toLinear(v / 255))
  const out = m.map((row) => Math.min(1, Math.max(0, row[0]! * lin[0]! + row[1]! * lin[1]! + row[2]! * lin[2]!)))
  return `#${out.map((v) => Math.round(toSrgb(v) * 255).toString(16).padStart(2, '0')).join('')}`
}

function deltaE(a: string, b: string): number {
  const [p, q] = [hexToOklch(a), hexToOklch(b)]
  const lab = ({ l, c, h }: typeof p) => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]
  const [x, y] = [lab(p), lab(q)]
  return 100 * Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!)
}

const MODES = ['light', 'dark'] as const
const INK = { light: '#ffffff', dark: TOKEN_BLOCKS.find((b) => b.selector === '.dark')!.tokens['--zone-ink']! }

describe('the zone scale (design reviews, Oct 2026)', () => {
  it.each(MODES)('%s: each zone stands apart from the next, Z1 to Z5', (mode) => {
    const zones = ZONE_HEX[mode]
    for (let i = 0; i < zones.length - 1; i++) {
      const [a, b] = [zones[i]!, zones[i + 1]!]
      expect(deltaE(a, b), `${a} / ${b}`).toBeGreaterThanOrEqual(NORMAL_MIN)
      // Not one colour even to a red-green colour-blind eye; the Z labels do the rest.
      expect(deltaE(simulate(a, PROTAN), simulate(b, PROTAN)), `protan ${a} / ${b}`).toBeGreaterThanOrEqual(CVD_FLOOR)
      expect(deltaE(simulate(a, DEUTAN), simulate(b, DEUTAN)), `deutan ${a} / ${b}`).toBeGreaterThanOrEqual(CVD_FLOOR)
    }
  })

  it('takes the 3.0 dark scale and the reviewed light Z3', () => {
    expect(ZONE_HEX.dark).toEqual(['#8a9bb0', '#5b9cf5', '#8f7cf0', '#c77ae6', '#f07aa8'])
    expect(ZONE_HEX.light[2]).toBe('#6a52d9')
  })

  // Plan's session bars write their minutes on the zone's fill in --zone-ink.
  it.each(MODES)('%s: the zone ink reads on Z3 and Z4 at 4.5:1', (mode) => {
    for (const zone of [ZONE_HEX[mode][2], ZONE_HEX[mode][3]]) expect(contrastRatio(INK[mode], zone), zone).toBeGreaterThanOrEqual(4.5)
  })

  it.each(MODES)('%s: every zone is a mark on the card, 3:1 or more', (mode) => {
    for (const zone of ZONE_HEX[mode]) expect(contrastRatio(zone, SURFACES[mode].card), zone).toBeGreaterThanOrEqual(3)
  })
})
