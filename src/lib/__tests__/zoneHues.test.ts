import { describe, expect, it } from 'vitest'
import { contrastRatio, hexToOklch } from '@/lib/oklch'
import { rgbTriplet } from '@/lib/palette'
import { SURFACES, TOKEN_BLOCKS, ZONE_HEX } from '@/lib/themeTokens'

/**
 * The zones are told apart in a stacked week by colour first (design review,
 * Oct 2026: Z3 and Z4 read as one colour there). Distances are OKLab ΔE ×100,
 * under normal vision and under protanopia and deuteranopia as Machado,
 * Oliveira & Fernandes (2009) simulate them at full severity: 15 apart for
 * anyone, 8 apart for a red-green colour-blind eye.
 */
const NORMAL_MIN = 15
const CVD_MIN = 8

type Matrix = readonly [readonly number[], readonly number[], readonly number[]]
const PROTAN: Matrix = [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]
const DEUTAN: Matrix = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]]

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** The colour as the eye the matrix models sees it, as a hex. */
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

describe('the zone scale (design review, Oct 2026)', () => {
  it.each(MODES)('%s: Z3 stands apart from Z2 and Z4, for every eye', (mode) => {
    const [, z2, z3, z4] = ZONE_HEX[mode]
    for (const other of [z2, z4]) {
      expect(deltaE(z3, other), `${z3} / ${other}`).toBeGreaterThanOrEqual(NORMAL_MIN)
      expect(deltaE(simulate(z3, PROTAN), simulate(other, PROTAN)), `protan ${z3} / ${other}`).toBeGreaterThanOrEqual(CVD_MIN)
      expect(deltaE(simulate(z3, DEUTAN), simulate(other, DEUTAN)), `deutan ${z3} / ${other}`).toBeGreaterThanOrEqual(CVD_MIN)
    }
  })

  // Plan's session bars write their minutes on the zone's fill in --zone-ink.
  it.each(MODES)('%s: the zone ink reads on Z3 and Z4 at 4.5:1', (mode) => {
    for (const zone of [ZONE_HEX[mode][2], ZONE_HEX[mode][3]]) expect(contrastRatio(INK[mode], zone), zone).toBeGreaterThanOrEqual(4.5)
  })

  it.each(MODES)('%s: every zone is a mark on the card, 3:1 or more', (mode) => {
    for (const zone of ZONE_HEX[mode]) expect(contrastRatio(zone, SURFACES[mode].card), zone).toBeGreaterThanOrEqual(3)
  })
})
