import { curatedAccent, type AccentId } from '@/lib/accentScale'
import { MAP_COLORS } from '@/lib/colors'
import { STATUS_HEX, SURFACES, ZONE_HEX } from '@/lib/themeTokens'

export type ThemeMode = 'light' | 'dark'

/** `stats`, the run's time in zones, is the fallback without GPS. */
export type ShareDesign = 'route' | 'stats' | 'photo'
export const SHARE_DESIGNS: readonly ShareDesign[] = ['route', 'stats', 'photo']

/**
 * One 4:5 box for every design, so the controls under it never jump: its size
 * on a phone, exported at 1080 x 1350.
 */
export const W = 300
export const H = 375

export interface SharePalette {
  mode: ThemeMode
  /** --background */
  bg: string
  /** --line */
  line: string
  /** --foreground */
  tx: string
  /** --muted-foreground */
  mu: string
  /** --track */
  fa: string
  /** --card */
  card: string
  /** --accent */
  acc: string
  zones: readonly string[]
  pos: string
  warn: string
  route: string
  /** The start marker's fill and the video's head dot: the accent. */
  marker: string
  markerRing: string
  markerOutline: string | null
  /** An interval route's own grey, under its reps. */
  trace: string
  casing: string
}

/** The start marker's ring, and on dark a thin outline that keeps it off the dark tiles. */
export const SHARE_MARKER_HEX = {
  light: { ring: '#ffffff', outline: null },
  dark: { ring: '#f2f4f3', outline: '#0c0d0d' },
} as const

export function sharePalette(accent: AccentId, mode: ThemeMode): SharePalette {
  const s = SURFACES[mode]
  return {
    mode,
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
    marker: curatedAccent(accent)[mode].acc,
    markerRing: SHARE_MARKER_HEX[mode].ring,
    markerOutline: SHARE_MARKER_HEX[mode].outline,
    trace: mode === 'light' ? '#8a8a8a' : '#6b7270',
    casing: mode === 'dark' ? MAP_COLORS.routeCasingDark : MAP_COLORS.routeCasingLight,
  }
}
