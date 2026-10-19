import { clampChromaToGamut, hexToOklch, oklchToHex } from './oklch'

const LIGHT = { l: 0.82, chroma: 0.6 }
const DEEP = { l: 0.43, chroma: 0.95 }

export interface HeatRamp {
  light: string
  deep: string
}

export function heatRamp(accent: string): HeatRamp {
  const { h } = hexToOklch(accent)
  const at = ({ l, chroma }: { l: number; chroma: number }) =>
    oklchToHex({ l, c: clampChromaToGamut(l, 0.5, h) * chroma, h })
  return { light: at(LIGHT), deep: at(DEEP) }
}
