import { ACCENT_SWATCHES, type AccentId } from '@/lib/accent'
import { HUE, rgbTriplet } from '@/lib/palette'

export type ThemeMode = 'light' | 'dark'
export type ShareDesign = 'aurora' | 'pulse' | 'terrain' | 'prism' | 'route' | 'map' | 'memory'
export const SHARE_DESIGNS: ShareDesign[] = ['aurora', 'pulse', 'terrain', 'prism', 'route', 'map', 'memory']

// The card is a 9:16 story frame - the format Instagram, Strava and Garmin all
// share to - rather than the full-height 9:19.5 phone screen it used to be, so
// the exported PNG drops straight into a story without letterboxing or a crop.
export const W = 390
export const H = 693

/**
 * The accent the canvas paints with, per theme mode. Dark reuses the picker's
 * own swatch; light needs a deeper tone to survive the pale backdrops, but not
 * the same deepening ACCENT_SWATCHES_LIGHT applies - nature and silver sit one
 * step brighter here so the route line does not go muddy against the map design.
 */
const CANVAS_ACCENT_HEX: Record<AccentId, { dark: string; light: string }> = {
  nature:      { dark: ACCENT_SWATCHES.nature,      light: HUE.roEmeraldDeep },
  performance: { dark: ACCENT_SWATCHES.performance, light: HUE.blue600 },
  impact:      { dark: ACCENT_SWATCHES.impact,      light: HUE.rose600 },
  motivation:  { dark: ACCENT_SWATCHES.motivation,  light: HUE.orange600 },
  endurance:   { dark: ACCENT_SWATCHES.endurance,   light: HUE.violet600 },
  silver:      { dark: ACCENT_SWATCHES.silver,      light: HUE.slate500 },
}

/** Accent RGB values [r, g, b] for canvas drawing per theme mode */
export const ACCENT_RGB = Object.fromEntries(
  Object.entries(CANVAS_ACCENT_HEX).map(([id, { dark, light }]) => [
    id,
    { dark: rgbTriplet(dark), light: rgbTriplet(light) },
  ]),
) as Record<AccentId, { dark: [number, number, number]; light: [number, number, number] }>
