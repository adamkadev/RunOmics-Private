import { curatedAccent, type AccentId } from '@/lib/accentScale'
import { MAP_COLORS } from '@/lib/colors'
import { STATUS_HEX, SURFACES, ZONE_HEX } from '@/lib/themeTokens'

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
  /** --card: the stat strip's own ground under the hairline (3.0.1 polish, mock 3f). */
  card: string
  /** --accent: the logo mark and the route trace (3.0.1). */
  acc: string
  zones: readonly string[]
  /** --pos and --warn: the verdict eyebrow's dot and word, as the Overview card colours them. */
  pos: string
  warn: string
  /** The route: the accent, as the app draws it (3.0.1 polish, mock 3f). */
  route: string
  /** The route's end markers: white on dark, the accent on light, so they read over the trace. */
  marker: string
  /** An interval route's own grey, under its reps: a step lighter than the ink on light. */
  trace: string
  /** ActivityMap's route casing. */
  casing: string
}

/** The route's end markers (3.0.1): white on dark, the accent on light, over an accent trace. */
export const SHARE_MARKER_HEX = { light: null, dark: '#f2f4f3' } as const

export function sharePalette(accent: AccentId, mode: ThemeMode): SharePalette {
  const s = SURFACES[mode]
  return {
    bg: s.background,
    line: s.line,
    tx: s.text,
    mu: s.text2,
    fa: s.faint,
    card: s.card,
    acc: curatedAccent(accent)[mode].acc,
    zones: ZONE_HEX[mode],
    pos: STATUS_HEX[mode].pos,
    warn: STATUS_HEX[mode].warn,
    route: curatedAccent(accent)[mode].acc,
    marker: SHARE_MARKER_HEX[mode] ?? curatedAccent(accent)[mode].acc,
    trace: mode === 'light' ? '#8a8a8a' : s.text2,
    casing: mode === 'dark' ? MAP_COLORS.routeCasingDark : MAP_COLORS.routeCasingLight,
  }
}
