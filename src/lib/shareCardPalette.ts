import { ACCENT_SWATCHES, type AccentId } from '@/lib/accent'
import { HUE, rgbTriplet } from '@/lib/palette'

export type ThemeMode = 'light' | 'dark'
export type ShareDesign = 'aurora' | 'pulse' | 'terrain' | 'prism' | 'route' | 'map' | 'memory'
export const SHARE_DESIGNS: ShareDesign[] = ['aurora', 'pulse', 'terrain', 'prism', 'route', 'map', 'memory']

export const W = 390
export const H = 693

const CANVAS_ACCENT_HEX: Record<AccentId, { dark: string; light: string }> = {
  nature:      { dark: ACCENT_SWATCHES.nature,      light: HUE.roEmeraldDeep },
  performance: { dark: ACCENT_SWATCHES.performance, light: HUE.blue600 },
  motivation:  { dark: ACCENT_SWATCHES.motivation,  light: HUE.orange600 },
  endurance:   { dark: ACCENT_SWATCHES.endurance,   light: HUE.violet600 },
  silver:      { dark: ACCENT_SWATCHES.silver,      light: HUE.slate500 },
}

export const ACCENT_RGB = Object.fromEntries(
  Object.entries(CANVAS_ACCENT_HEX).map(([id, { dark, light }]) => [
    id,
    { dark: rgbTriplet(dark), light: rgbTriplet(light) },
  ]),
) as Record<AccentId, { dark: [number, number, number]; light: [number, number, number] }>
