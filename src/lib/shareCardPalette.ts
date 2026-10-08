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
 * The card, one 4:5 box for every design (design review, Oct 2026: the card
 * changed height per tab and the controls under it jumped): 300 x 375, the
 * size it shows at on a phone, exported at 1080 x 1350. Header, middle and
 * stat row; only the middle changes, taking what the title and stats leave.
 */
export const W = 300
export const H = 375

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
