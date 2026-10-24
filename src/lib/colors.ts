import { HUE, ink, white } from '@/lib/palette'
import { isActivityType, type ActivityType } from '@/domain/activity/types'
import type { TrainingStatusType } from '@/domain/training/status'

const c = HUE

export const CHART_COLORS = {
  brand:     c.roEmerald,

  // Neutral series, never a hue that could read as a zone or a status.
  ctl:       'var(--metric-fitness)',
  atl:       'var(--metric-fatigue)',

  hr:            c.red500,
  hrEasy:        c.red300,
  pace:          c.blue500,
  elevation:     c.roRust,
  // Lines that fail 3:1 on white take a darker step in light mode through
  // their token; the others are the same hex in both themes.
  cadence:       'var(--chart-cadence)',
  efficiency:    c.violet500,

  // RunningFormChart draws one series at a time, so each derived metric shares its parent's family:
  // vertical ratio is oscillation over stride, and stride length is the other half of cadence.
  groundContact:       'var(--chart-ground-contact)',
  verticalOscillation: c.rose500,
  verticalRatio:       c.rose600,
  strideLength:        'var(--chart-cadence)',

  easy:      'var(--chart-easy)',
  hard:      'var(--chart-hard)',

  axisTick:        c.roInkInv2,
  referenceLine:   'var(--divider)',
  referenceTarget: c.roInkInv3,
  tooltipCursor:   'var(--divider)',
} as const

/** A status is good, caution or bad news, so it reads the status tokens, never a zone. Garmin's Peaking is `fresh`. */
export const TRAINING_STATUS_COLORS: Record<TrainingStatusType, string> = {
  productive:   'var(--pos)',
  fresh:        'color-mix(in srgb, var(--pos) 50%, transparent)',
  maintaining:  'var(--muted-foreground)',
  recovery:     'var(--zone-1)',
  unproductive: 'var(--warn)',
  detraining:   'var(--line-2)',
  overreaching: 'var(--neg)',
}

/**
 * A session's colour is its intensity, read off this one ramp everywhere a plan or a list is drawn.
 * Charts that stack types side by side need distinguishable hues and keep ACTIVITY_TYPE_STYLE.
 */
export const RUN_TYPE_ZONE: Record<ActivityType, 1 | 2 | 3 | 4 | 5> = {
  Sprint: 5,
  Anaerobic: 5,
  VO2Max: 5,
  Threshold: 4,
  Tempo: 3,
  Base: 2,
  Race: 5,
}

export function runTypeZone(type: string | null | undefined): 1 | 2 | 3 | 4 | 5 {
  return isActivityType(type) ? RUN_TYPE_ZONE[type] : RUN_TYPE_ZONE.Base
}

export function runTypeColor(type: string | null | undefined): string {
  return zoneColor(runTypeZone(type))
}

export type SessionZone = 1 | 2 | 3 | 4 | 5

export function zoneColor(zone: SessionZone): string {
  return `var(--zone-${zone})`
}

/** Every screen that colours a session, planned or run, asks this, so it can't be red on one screen and orange on the next. */
export function sessionZone(session: { type?: string | null }): SessionZone {
  return runTypeZone(session.type)
}

// Tokens, so each theme takes its own text-grade step.
export const READINESS_TONE_COLORS = {
  go:      'var(--tone-go)',
  caution: 'var(--tone-caution)',
  hold:    'var(--tone-hold)',
} as const


/**
 * Shoe dots are pair identity, not state, so the ramp is neutral: the muted text scale rather than `paper()`,
 * since white would vanish on light surfaces. Four steps for the registry's four pairs; a fifth would collide with the first.
 */
export const SHOE_DOT_RAMP = [
  'var(--foreground)',
  'var(--muted-foreground)',
  'var(--subtle)',
  'var(--subtle-2)',
] as const

/** `effort` is Z4 unless the bar is told the session's own zone. */
export const WORKOUT_SEGMENT_COLORS = {
  warmup:   'color-mix(in srgb, var(--subtle) 32%, transparent)',
  effort:   'var(--zone-4)',
  recovery: 'color-mix(in srgb, var(--zone-1) 60%, transparent)',
  cooldown: 'color-mix(in srgb, var(--subtle) 32%, transparent)',
} as const

/**
 * Fixed hues, never the accent: an accent-tied line would change with the user's theme and clash with the route.
 * The red is close to the error colour, so it is kept to chart lines and their scrub dots: never text, never a badge.
 */
export const RUN_CHART_LINE = {
  hr: '#ff6b6b',
  // The blue every other pace series takes; a cyan would read as the cyan accent.
  pace: c.blue500,
  cadence: runTypeColor('Threshold'),
} as const

export const CELEBRATION_COLORS = {
  confetti: [c.green400, c.amber400, c.cyan300, c.pink400] as const,
} as const

export const MAP_COLORS = {
  routeCasingDark:  c.gray800,
  routeCasingLight: white,
  markerRingDark:   c.mapMarkerRing,
  markerRingLight:  white,
  markerLabel:      white,
  markerShadow:     `0 2px 8px ${ink(0.35)}`,
  chipShadow:       `0 1px 4px ${ink(0.35)}`,
} as const

// The last-resort error screen draws before any stylesheet: the dark ground and ink, and the default teal accent.
export const BOOT_COLORS = {
  background: '#0b0c0c',
  foreground: '#f2f4f3',
  actionBg: '#2dd4a7',
  actionFg: '#07261d',
} as const


export const TEMP_BAND_COLORS = {
  cold:      c.blue400,
  cool:      c.emerald400,
  mild:      c.amber400,
  warm:      c.orange500,
  hot:       c.red500,
} as const

export function tempBandColor(celsius: number): string {
  if (celsius < 10) return TEMP_BAND_COLORS.cold
  if (celsius < 18) return TEMP_BAND_COLORS.cool
  if (celsius < 24) return TEMP_BAND_COLORS.mild
  if (celsius < 30) return TEMP_BAND_COLORS.warm
  return TEMP_BAND_COLORS.hot
}
