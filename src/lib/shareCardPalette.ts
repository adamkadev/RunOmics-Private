import { curatedAccent, type AccentId } from '@/lib/accentScale'
import { MAP_COLORS } from '@/lib/colors'
import { STATUS_HEX, SURFACES, ZONE_HEX, ZONE_MODERATE_HEX } from '@/lib/themeTokens'

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

/** `story` is 9:16, exported at 1080 x 1920: the same width, the extra height for the map, hero or photo. */
export type ShareSize = 'portrait' | 'story'
export const SHARE_SIZES: readonly ShareSize[] = ['portrait', 'story']

export function shareCardHeight(size: ShareSize = 'portrait'): number {
  return size === 'story' ? (W * 16) / 9 : H
}

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
  /** Time in heart-rate zones: Z3 is the grey-blue moderate of Easy vs hard. */
  hrZones: readonly string[]
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
  /** A record's eyebrow and stat label: a trophy's gold, no accent's and no zone's. */
  record: string
}

/** The start marker's ring, and on dark a thin outline that keeps it off the dark tiles. */
export const SHARE_MARKER_HEX = {
  light: { ring: '#ffffff', outline: null },
  dark: { ring: '#f2f4f3', outline: '#0c0d0d' },
} as const

/** On a photo the scrim is dark whatever the theme, so the record takes the dark gold. */
export const SHARE_RECORD_HEX = { light: '#8f5f00', dark: '#f3c45a' } as const

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
    hrZones: ZONE_HEX[mode].map((hex, i) => (i === 2 ? ZONE_MODERATE_HEX[mode] : hex)),
    pos: STATUS_HEX[mode].pos,
    warn: STATUS_HEX[mode].warn,
    route: curatedAccent(accent)[mode].acc,
    marker: curatedAccent(accent)[mode].acc,
    markerRing: SHARE_MARKER_HEX[mode].ring,
    markerOutline: SHARE_MARKER_HEX[mode].outline,
    trace: mode === 'light' ? '#7a807e' : '#b9bfbc',
    casing: mode === 'dark' ? MAP_COLORS.routeCasingDark : MAP_COLORS.routeCasingLight,
    record: SHARE_RECORD_HEX[mode],
  }
}
