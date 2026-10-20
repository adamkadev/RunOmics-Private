import { clampChromaToGamut, hexToOklch, oklchToHex } from './oklch'

const LIGHT = { l: 0.82, chroma: 0.6 }
const DEEP = { l: 0.43, chroma: 0.95 }

/**
 * Under this chroma an accent has no hue worth ramping: the white accent's
 * is a rounding error, and a ramp built on it swung to whatever hue the
 * rounding left. It takes a graphite ramp instead (3.0 override 9).
 */
const NEUTRAL_CHROMA = 0.02
const GRAPHITE = { light: '#c9ccce', deep: '#3d4446' } as const

export interface HeatRamp {
  light: string
  deep: string
}

export function heatRamp(accent: string): HeatRamp {
  const { c, h } = hexToOklch(accent)
  if (c < NEUTRAL_CHROMA) return { ...GRAPHITE }
  const at = ({ l, chroma }: { l: number; chroma: number }) =>
    oklchToHex({ l, c: clampChromaToGamut(l, 0.5, h) * chroma, h })
  return { light: at(LIGHT), deep: at(DEEP) }
}
