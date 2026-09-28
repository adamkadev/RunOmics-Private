import { HUE, ink, paper, white } from '@/lib/palette'
import { isActivityType, type ActivityType } from '@/domain/activity/types'
import type { TrainingStatusType } from '@/domain/training/status'

const c = HUE

export const CHART_COLORS = {
  brand:     c.roEmerald,

  // Fitness is the solid text line and fatigue the dashed muted one (v4.17):
  // neutral series, never a hue that could read as a zone or a status.
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

  // The five running-form metrics are never drawn together - RunningFormChart
  // renders one series at a time - so each derived metric shares its parent's
  // family instead of buying a new one: vertical ratio is oscillation over
  // stride, and stride length is the other half of cadence. That retires
  // fuchsia and teal from the app, and both fills carry white text better.
  groundContact:       'var(--chart-ground-contact)',
  verticalOscillation: c.rose500,
  verticalRatio:       c.rose600,
  strideLength:        'var(--chart-cadence)',

  easy:      'var(--chart-easy)',
  hard:      'var(--chart-hard)',

  axisTick:        c.roInkInv2,
  // Grid and reference lines are the divider (neutral surfaces).
  referenceLine:   'var(--divider)',
  referenceTarget: c.roInkInv3,
  tooltipCursor:   'var(--divider)',
} as const

/**
 * Garmin's training statuses (v4.17): a status is good, caution or bad news,
 * so it reads the status tokens and never a zone - overreaching used to be
 * the Z5 pink a VO2max session is drawn in. Productive is pos and Peaking
 * (the app's `fresh`) its lighter step, good news that is not building;
 * Unproductive, load that isn't turning into fitness, is caution; Overreaching
 * is neg. Maintaining and Detraining say neither and take the two neutral
 * greys, Detraining the fainter; Recovery, a rest state, is the recovery zone.
 */
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
 * `peak` was `violet500`, the same hex as `TRAINING_STATUS_COLORS.fresh`, and
 * WeekPurposeBanner paints its headline from whichever of the two maps applies
 * - so one violet meant "fresh" above a phase track that used it for "peak".
 * Bronze keeps peak inside `taper`'s amber family a clear 25 dE away, and is
 * the best-contrasting entry in the map on both grounds.
 */
export const TRAINING_PLAN_PHASE_COLORS: Record<string, string> = {
  base:    c.roEmerald,
  build:   c.blue500,
  peak:    c.amber700,
  taper:   c.amber500,
  raceDay: c.red500,
}

export const ZONE_COLORS: Record<number, string> = {
  1: c.gray400,
  2: c.blue400,
  3: c.emerald400,
  4: c.orange500,
  5: c.red500,
}

export const ZONE_COLORS_DARK: Record<number, string> = {
  1: paper(0.55),
  2: c.roBlueHi,
  3: c.roEmeraldHi,
  4: c.roOrangeHi,
  5: c.roRed,
}

/**
 * The zone each run type targets. A session's colour is its intensity, read
 * off this one ramp everywhere a plan or a list is drawn - Plan's week and
 * month, the session rows, the activity lists and a shoe's mix. Threshold used
 * to be salmon on one day and orange on the next, orange also meant "today",
 * and salmon also meant Z5, heart rate and "destructive".
 *
 * Charts that stack types side by side (monthly volume, the map's type picker)
 * still need seven distinguishable hues and keep ACTIVITY_TYPE_STYLE.
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

/** The zone colour a run type is drawn in, as a token. */
export function runTypeColor(type: string | null | undefined): string {
  return zoneColor(runTypeZone(type))
}

export type SessionZone = 1 | 2 | 3 | 4 | 5

/** A zone's colour token. */
export function zoneColor(zone: SessionZone): string {
  return `var(--zone-${zone})`
}

/**
 * The one zone a session is drawn in, planned or run: Plan's bars and list,
 * Today's day tiles, the Month bars, the activity dots and the shoe mix all
 * ask this, so the same session can't be red on one screen and orange on the
 * next. It is the zone of the session's type (RUN_TYPE_ZONE); the title is
 * made to agree with it by sessionTitle.
 */
export function sessionZone(session: { type?: string | null }): SessionZone {
  return runTypeZone(session.type)
}

export const ZONE_COLOR_CLASSES: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-[var(--zone-1)]', text: 'text-[var(--zone-1)]' },
  2: { bg: 'bg-[var(--zone-2)]', text: 'text-[var(--zone-2)]' },
  3: { bg: 'bg-[var(--zone-3)]', text: 'text-[var(--zone-3)]' },
  4: { bg: 'bg-[var(--zone-4)]', text: 'text-[var(--zone-4)]' },
  5: { bg: 'bg-[var(--zone-5)]', text: 'text-[var(--zone-5)]' },
}

export const TRAINING_METRIC_COLORS = {
  form:    'var(--metric-form)',
  fitness: 'var(--metric-fitness)',
  fatigue: 'var(--metric-fatigue)',
} as const

// Trend deltas are coloured by what they mean: lib/deltaTone (v4.7).

// The hero's readiness tone, as tokens: each theme takes its own text-grade
// step, where the fixed hexes this replaced were dark-mode colours in both.
export const READINESS_TONE_COLORS = {
  go:      'var(--tone-go)',
  caution: 'var(--tone-caution)',
  hold:    'var(--tone-hold)',
} as const


/**
 * The shoe dots are pair identity, not state: they say which column of the
 * comparison table a number belongs to, and which pair ran an activity. The old
 * ramp spent roAmber, roViolet and roPink on that, which read as status the dot
 * never carried, so the ramp is neutral.
 *
 * Built from the muted text scale rather than `paper()` because the dots also
 * render on light surfaces, where white would vanish - these four tokens are
 * already tuned for both themes. Four steps because the registry holds four
 * pairs; a fifth would collide with the first.
 */
export const SHOE_DOT_RAMP = [
  'var(--foreground)',
  'var(--muted-foreground)',
  'var(--subtle)',
  'var(--subtle-2)',
] as const

/**
 * A planned session's segments, as tokens (v4.17): warm-up and cool-down one
 * neutral, the jog between reps Z1's tint, the work its zone - Z4 unless the
 * bar is told the session's own. The work was a fixed amber and the recovery
 * a fixed blue that said "easy" on every session, and the white-alpha ease
 * vanished on a light card.
 */
export const WORKOUT_SEGMENT_COLORS = {
  warmup:   'color-mix(in srgb, var(--subtle) 32%, transparent)',
  effort:   'var(--zone-4)',
  recovery: 'color-mix(in srgb, var(--zone-1) 60%, transparent)',
  cooldown: 'color-mix(in srgb, var(--subtle) 32%, transparent)',
} as const

/**
 * Ink for the duration labels that sit inside the structure bar. Only `effort`
 * is drawn at full height, so it is the only segment wide and tall enough to
 * carry text, in the same zone ink the session bar writes on its fills.
 */
export const WORKOUT_SEGMENT_INK = {
  effort: 'var(--zone-ink)',
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

/**
 * The route's pace ramp, fastest to slowest, in the zones' own hex (MapLibre
 * paints a literal, not a token): Z5 to Z1, so a fast stretch of route is
 * the colour of a hard session, and no lime or brand green is left (v4.3.2).
 */
export const PACE_ROUTE_COLORS = {
  fast:      c.zone5Dark,
  tempo:     c.zone4Dark,
  steady:    c.roEmeraldHi,
  easy:      c.zone2Dark,
  recovery:  c.roZone1,
} as const

/**
 * The ramp's stops, seconds per km to colour: the map interpolates between
 * them, and the share card, which draws on a canvas, does the same.
 */
export const PACE_ROUTE_STOPS: readonly (readonly [pace: number, color: string])[] = [
  [255, PACE_ROUTE_COLORS.fast],
  [300, PACE_ROUTE_COLORS.tempo],
  [350, PACE_ROUTE_COLORS.steady],
  [390, PACE_ROUTE_COLORS.easy],
  [450, PACE_ROUTE_COLORS.recovery],
]

// The last-resort error screen draws before any stylesheet: the v4.17 dark
// ground and ink, and the default teal accent for its one action.
export const BOOT_COLORS = {
  background: '#0c0d0d',
  foreground: '#f1f2f1',
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
