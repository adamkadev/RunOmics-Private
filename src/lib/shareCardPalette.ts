import { ACCENT_SWATCHES, ACCENT_SWATCHES_LIGHT, type AccentId } from '@/lib/accent'
import { rgbTriplet } from '@/lib/palette'

export type ThemeMode = 'light' | 'dark'
export type ShareDesign = 'aurora' | 'pulse' | 'terrain' | 'prism' | 'route' | 'map' | 'memory'
export const SHARE_DESIGNS: ShareDesign[] = ['aurora', 'pulse', 'terrain', 'prism', 'route', 'map', 'memory']

export const W = 390
export const H = 693

// A card on a dark canvas takes the accent's fill; on a light canvas it takes
// the deeper text tone, which is the relationship the hand-built table had.
const CANVAS_ACCENT_HEX: Record<AccentId, { dark: string; light: string }> = Object.fromEntries(
  (Object.keys(ACCENT_SWATCHES) as AccentId[]).map((id) => [
    id,
    { dark: ACCENT_SWATCHES[id], light: ACCENT_SWATCHES_LIGHT[id] },
  ]),
) as Record<AccentId, { dark: string; light: string }>

export const ACCENT_RGB = Object.fromEntries(
  Object.entries(CANVAS_ACCENT_HEX).map(([id, { dark, light }]) => [
    id,
    { dark: rgbTriplet(dark), light: rgbTriplet(light) },
  ]),
) as Record<AccentId, { dark: [number, number, number]; light: [number, number, number] }>
