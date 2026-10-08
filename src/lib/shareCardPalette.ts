import { curatedAccent, type AccentId } from '@/lib/accentScale'
import { MAP_COLORS } from '@/lib/colors'
import { SURFACES, ZONE_HEX } from '@/lib/themeTokens'

export type ThemeMode = 'light' | 'dark'

/**
 * Three middles in one frame (v4.9): the route on its map, the run's time in
 * zones (the fallback without GPS, treadmill runs included), or a photo.
 */
export type ShareDesign = 'route' | 'stats' | 'photo'
export const SHARE_DESIGNS: readonly ShareDesign[] = ['route', 'stats', 'photo']

/**
 * The card, 390 x 693: header, middle, stat row. Only the middle changes, and
 * it takes whatever height the title and the stats leave (shareCardLayout).
 */
export const W = 390
export const H = 693

/** The app's tokens for one theme and accent, as a canvas can take them. */
export interface SharePalette {
  /** --background: the whole card, header and stat row alike. */
  bg: string
  /** --line: the route legend's outline. */
  line: string
  /** --foreground */
  tx: string
  /** --muted-foreground: eyebrow, date, units, labels. */
  mu: string
  /** --track: the zone rows' track and the empty photo frame. */
  fa: string
  /** --accent: the logo mark and the route's point markers, never a trace (routeMarkers). */
  acc: string
  zones: readonly string[]
  /** ActivityMap's route casing. */
  casing: string
}

export function sharePalette(accent: AccentId, mode: ThemeMode): SharePalette {
  const s = SURFACES[mode]
  return {
    bg: s.background,
    line: s.line,
    tx: s.text,
    mu: s.text2,
    fa: s.faint,
    acc: curatedAccent(accent)[mode].acc,
    zones: ZONE_HEX[mode],
    casing: mode === 'dark' ? MAP_COLORS.routeCasingDark : MAP_COLORS.routeCasingLight,
  }
}
