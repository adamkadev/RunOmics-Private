// Semantic color sets for everything the CSS cannot reach: Recharts and inline
// SVG (which need real strings in attributes), MapLibre paint properties, and
// the share-card canvas.
//
// Every value here resolves through `@/lib/palette` - the one place raw hex
// literals are allowed to exist. Anything a stylesheet *can* reach belongs in
// `@/lib/themeTokens` instead, so it stays accent- and theme-aware.

import { HUE, ink, paper, white, withAlpha } from '@/lib/palette'

const c = HUE

// ── Charts ──────────────────────────────────────────────────────────────────

// Form (TSB), weekly volume and the long-run bar used to live here as fixed
// emerald. They are the "this is your headline number" marks, so they now come
// from `useAccentUiColor()` and repaint with the accent picker; everything left
// below is either categorical or semantic and stays put.
export const CHART_COLORS = {
  // Brand green, for the marks that are the app's own voice rather than a
  // metric: the map's route/start marker and the pace ramp's easy end.
  brand:     c.roEmerald,

  ctl:       c.blue500,   // fitness (chronic)
  atl:       c.orange500, // fatigue (acute)

  hr:            c.red500,
  hrEasy:        c.red300,
  pace:          c.blue500,
  elevation:     c.roRust, // bumped chroma from stone-500, which read as gray in the categorical set
  cadence:       c.sky500,
  efficiency:    c.violet500,

  groundContact:       c.amber500,
  verticalOscillation: c.rose500,
  verticalRatio:       c.fuchsia500, // oscillation normalised by stride, so kept adjacent to rose
  strideLength:        c.teal500,

  easy:      c.emerald400,
  hard:      c.orange400,

  // Chart decoration - the muted floor is the dark theme's own `--subtle` /
  // `--muted-foreground`, so axis/legend text clears WCAG contrast against the
  // dark-mode background.
  axisTick:        c.roInkInv2,
  referenceLine:   c.gray200,
  referenceTarget: c.roInkInv3,
  tooltipCursor:   withAlpha(c.roInkInv2, 0.12),
} as const

// Garmin training status, keyed by the names in GetTrainingStatus's
// TrainingStatusType. Mirrors the watch's own ladder so the app and Garmin
// Connect read the same: violet = peaking, green = paying off, yellow = holding,
// blue = deliberate rest, grey = fading, orange/red = no longer productive.
export const TRAINING_STATUS_COLORS: Record<string, string> = {
  fresh:        c.violet500, // Garmin's "Peaking"
  productive:   c.emerald400,
  maintaining:  c.yellow500,
  recovery:     c.blue600,
  unproductive: c.orange500,
  detraining:   c.zinc400,
  overreaching: c.red500,
}

// Garmin Coach plan phase, keyed by the names in GetTrainingPlan's
// TrainingPlanPhase. A separate ramp from TRAINING_STATUS_COLORS: this is
// intent (what the plan calls for), not a reading of what happened, so it
// gets its own build -> peak -> taper -> race-day progression instead of
// reusing the status ladder's green/blue/amber/red meaning.
export const TRAINING_PLAN_PHASE_COLORS: Record<string, string> = {
  base:    c.roEmerald,
  build:   c.blue500,
  peak:    c.violet500,
  taper:   c.amber500,
  raceDay: c.red500,
}

// ── Heart-rate zones ────────────────────────────────────────────────────────
// Three ramps exist because they answer different questions and were tuned
// against different backdrops. They are listed together so the divergence is
// visible rather than scattered across components.

/** Z1-Z5 for charts and inline SVG, on a light canvas. */
export const ZONE_COLORS: Record<number, string> = {
  1: c.gray400,
  2: c.blue400,
  3: c.emerald400,
  4: c.orange500,
  5: c.red500,
}

/**
 * The dark-canvas half of the same ramp - the `--zone-4` / `--zone-5` tokens.
 * Z4 orange500 and Z5 red500 collapse into one hue at donut-slice size on the
 * near-black canvas; the lifted pair keeps them apart. Recharts takes attribute
 * strings, so the tokens have to be resolved here rather than via `var()`.
 */
export const ZONE_COLORS_DARK: Record<number, string> = {
  1: paper(0.55),
  2: c.roBlueHi,
  3: c.roEmeraldHi,
  4: c.roOrangeHi,
  5: c.roRed,
}

// HR zone Tailwind classes, keyed by zone number. Shared between ZoneBar
// (activity detail) and ProfileHrZones (settings), since they style the same
// Z1-Z5 scale. These resolve to the `--zone-N` tokens, which carry the
// light/dark pair - Tailwind needs the class string to be a literal, so the
// theme switch has to happen inside the variable rather than in the class.
export const ZONE_COLOR_CLASSES: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-[var(--zone-1)]', text: 'text-[var(--zone-1)]' },
  2: { bg: 'bg-[var(--zone-2)]', text: 'text-[var(--zone-2)]' },
  3: { bg: 'bg-[var(--zone-3)]', text: 'text-[var(--zone-3)]' },
  4: { bg: 'bg-[var(--zone-4)]', text: 'text-[var(--zone-4)]' },
  5: { bg: 'bg-[var(--zone-5)]', text: 'text-[var(--zone-5)]' },
}

/**
 * The three headline zones on the Athlete card. Saturated a step past
 * ZONE_COLORS because they sit as small text on a near-opaque tile rather than
 * as filled chart marks.
 */
export const ZONE_HEADLINE_COLORS: Record<2 | 4 | 5, string> = {
  2: c.blue500,
  4: c.orange500,
  5: c.red500,
}

// ── Readiness / status ──────────────────────────────────────────────────────

// Accent-independent: a readiness verdict means the same thing (go/caution/hold)
// whichever accent the athlete has chosen.
export const READINESS_TONE_COLORS = {
  go:      c.roEmerald,
  caution: c.roAmber,
  hold:    c.red500,
} as const

/**
 * Goal pacing on the monthly volume chart. `ahead` fills with the live accent -
 * hitting the target is the app's own success state - while the other two carry
 * fixed hues so "behind" cannot end up reading as a brand color.
 */
export const GOAL_PACE_COLORS = {
  ahead:   { bg: 'color-mix(in srgb, var(--accent) 6%, transparent)', border: 'color-mix(in srgb, var(--accent) 25%, transparent)', bar: 'var(--accent)' },
  onTrack: { bg: withAlpha(c.roBlueMid, 0.1),   border: withAlpha(c.roBlueMid, 0.28), bar: c.roBlueHi },
  behind:  { bg: withAlpha(c.roPink, 0.06),     border: withAlpha(c.roPink, 0.25),    bar: c.roPink },
  pending: { bg: '',                            border: '',                           bar: 'var(--track-on-dark)' },
} as const

/** Shoe wear tints on the shoes grid - amber warns, red says retire it. */
export const SHOE_WEAR_TINTS = {
  watch: {
    background: `linear-gradient(150deg, ${withAlpha(c.amber500, 0.16)}, ${withAlpha(c.amber500, 0.02)})`,
    borderColor: withAlpha(c.amber500, 0.35),
  },
  replace: {
    background: `linear-gradient(150deg, ${withAlpha(c.red500, 0.16)}, ${withAlpha(c.red500, 0.02)})`,
    borderColor: withAlpha(c.red500, 0.35),
  },
} as const

/** Planned-workout segment types, on the always-dark workout sheet. */
export const WORKOUT_SEGMENT_COLORS = {
  warmup:   paper(0.18),
  effort:   c.roAmber,
  recovery: c.blue500,
  cooldown: paper(0.18),
} as const

/**
 * The planned-workout sheet, which is always dark regardless of theme so the
 * activity-type tint stays readable on top of it.
 */
export const WORKOUT_SHEET_COLORS = {
  base: withAlpha(c.sheetInk, 0.82),
  /** Bottom stop of the gradient when an activity-type tint is layered above. */
  baseTinted: withAlpha(c.sheetInk, 0.88),
  border: paper(0.08),
  handle: paper(0.2),
  iconWell: paper(0.07),
  iconFallback: c.gray400,
  /** Alpha applied to the activity-type color for each layer of the sheet. */
  tint: { fill: 0.12, border: 0.27, handle: 0.33, iconWell: 0.1 },
} as const

/** Confetti on the goal-reached overlay. */
export const CELEBRATION_COLORS = {
  confetti: [c.green400, c.amber400, c.cyan300, c.pink400] as const,
  burst:    `radial-gradient(circle, ${c.green500}, ${c.green700})`,
  burstGlow: `0 0 50px ${withAlpha(c.green500, 0.5)}`,
} as const

/**
 * Fixed brand-green washes for the season headline and race footer surfaces.
 * These deliberately stay emerald rather than following the accent picker, so
 * they are the brand's own voice rather than the athlete's chosen tint.
 */
export const BRAND_TINTS = {
  headlineBorder: withAlpha(c.roEmerald, 0.32),
  headlineFill: `linear-gradient(158deg, ${withAlpha(c.roEmerald, 0.11)}, ${withAlpha(c.roEmerald, 0.02)})`,
  footerFill: `linear-gradient(155deg, ${withAlpha(c.roEmerald, 0.08)}, transparent)`,
} as const

// ── Maps ────────────────────────────────────────────────────────────────────

export const MAP_COLORS = {
  /** Casing drawn under the route line so it reads against any basemap. */
  routeCasingDark:  c.gray800,
  routeCasingLight: white,
  /** Ring around the start/end markers. */
  markerRingDark:   c.mapMarkerRing,
  markerRingLight:  white,
  markerLabel:      white,
  markerShadow:     `0 2px 8px ${ink(0.35)}`,
  chipShadow:       `0 1px 4px ${ink(0.35)}`,
  /** Ink on the amber legend chip, which stays amber in both themes. */
  chipInkOnAmber:   c.mapChipInk,
} as const

// Activity map route gradient (pace-based), thresholds (sec/km) calibrated on
// this athlete's actual pace distribution (median ~5:52/km, p90 ~7:10/km) rather
// than generic splits - so the gradient actually spans most real segments instead
// of sitting mostly in one or two colors. Ends reuse CHART_COLORS.hr/brand/pace
// so the map stays visually consistent with the HR/training-load/pace charts.
export const PACE_ROUTE_COLORS = {
  fast:      CHART_COLORS.hr,    // <= 4:15/km - intervals, race pace
  tempo:     c.amber500,         //    5:00/km
  steady:    c.lime500,          //    5:50/km - near median pace
  easy:      CHART_COLORS.brand, //    6:30/km
  recovery:  CHART_COLORS.pace,  // >= 7:30/km - recovery jog / walk breaks
} as const

// Running heatmap intensity ramp (rare -> frequent). Cool->hot and deliberately
// accent-independent, like PACE_ROUTE_COLORS / TEMP_BAND_COLORS: how often a stretch
// was run is a property of the data, not a theme choice, so the map must not repaint
// when the user changes their accent. Anchors reuse chart hues so the map sits in the
// same visual system, and skip yellow/lime (they wash out on the pale basemap). Read
// as a continuous gradient, not a categorical legend - adjacent stops are meant to
// blend. The hottest end reuses CHART_COLORS.hr so "most run" shares the app's
// red = highest-intensity language (HR, temperature).
export const HEAT_ROUTE_COLORS = {
  rare:     CHART_COLORS.pace,                // blue   - run once
  seldom:   CHART_COLORS.efficiency,          // violet
  often:    CHART_COLORS.verticalOscillation, // rose
  frequent: CHART_COLORS.hr,                  // red    - run most often
} as const

// ── Share card (canvas) ─────────────────────────────────────────────────────

/**
 * Backdrops for the share-card designs, as [light, dark] pairs. The canvas
 * cannot read CSS variables, so these are the one place the share card's own
 * surfaces are named.
 */
export const SHARE_BACKDROPS = {
  aurora:  [c.shareAuroraLight,  c.shareAuroraDark],
  pulse:   [c.sharePulseLight,   c.sharePulseDark],
  terrain: [c.shareTerrainLight, c.shareTerrainDark],
  prism:   [c.sharePrismLight,   c.sharePrismDark],
  map:     [c.shareMapLight,     c.shareMapDark],
} as const

export const SHARE_CARD_COLORS = {
  /** Start-of-route marker - green means "you began here" regardless of accent. */
  routeStart: c.green500,
  /** Finish marker fallback: when the accent is itself green the accent-colored
   *  finish dot would collide with the green start, so it flips to this red -
   *  the start/finish convention Strava and Garmin use. */
  routeFinish: c.red500,
  /** Grid-line label plates on the map design. */
  mapLabelPlateDark:  withAlpha(c.shareMapDark, 0.76),
  mapLabelPlateLight: withAlpha(c.shareMapLight, 0.76),
  /** Km pill and compass backing on the map design. */
  mapPillDark:  withAlpha(c.shareMapDark, 0.84),
  mapPillLight: paper(0.88),
  /** Golden-hour placeholder shown until the athlete picks a photo. */
  memoryDark:  [c.shareMemoryDark1, c.shareMemoryDark2, c.shareMemoryDark3, c.shareMemoryDark4] as const,
  memoryLight: [c.shareMemoryLight1, c.shareMemoryLight2, c.shareMemoryLight3, c.shareMemoryLight4] as const,
  /** Tree-line silhouette on the memory placeholder. */
  memoryHorizonLight: withAlpha(c.shareMemoryHorizon, 0.48),
  /** Off state of the share-card toggles (iOS system fill). */
  toggleOff: withAlpha(c.iosFill, 0.22),
  /** Alpha applied to the chosen accent for a selected thumbnail's ring. */
  thumbRingAlpha: 0.33,
  /** Label on the accent-filled primary action. */
  onAccent: white,
  /** Hue wheel behind the "custom color" swatch - pure CSS hues, no palette. */
  customWheel: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
} as const

/**
 * Chrome for the surfaces that render before, or entirely without, globals.css:
 * the PWA launch screens and the root error boundary. They cannot read CSS
 * variables, so they carry their own deep-navy scheme - the same value the
 * performance accent uses for its dark background.
 */
export const BOOT_COLORS = {
  background: c.performanceBgDark,
  foreground: c.gray200,
  actionBg: c.emerald500,
  actionFg: c.performanceBgDark,
  logo: c.emerald400,
} as const

// ── Race distance identity ──────────────────────────────────────────────────

// Race distance identity (Goals season-PR cards): each distance category gets
// its own gradient overlay + text tint so cards read apart at a glance, same
// idea as activity-type dots but for race length rather than effort type.
const DISTANCE_TINTS = [
  { match: /marathon/i, overlay: 'from-orange-500/35', text: 'text-orange-400' },
  { match: /half|semi/i, overlay: 'from-emerald-500/35', text: 'text-emerald-400' },
  { match: /10\s*k/i, overlay: 'from-blue-500/35', text: 'text-blue-400' },
  { match: /5\s*k/i, overlay: 'from-violet-500/35', text: 'text-violet-400' },
  { match: /1\s*k\b|mile/i, overlay: 'from-rose-500/35', text: 'text-rose-400' },
] as const

export function raceDistanceTint(distance: string): { overlay: string; text: string } {
  const found = DISTANCE_TINTS.find((d) => d.match.test(distance))
  return found ?? { overlay: 'from-accent/35', text: 'text-accent-text' }
}

// ── Temperature ─────────────────────────────────────────────────────────────

export function temperatureIconColor(celsius: number): string {
  if (celsius < 5)  return 'text-blue-500 dark:text-blue-400'
  if (celsius < 12) return 'text-cyan-500 dark:text-cyan-400'
  if (celsius < 18) return 'text-accent-text'
  if (celsius < 24) return 'text-amber-500 dark:text-amber-400'
  if (celsius < 30) return 'text-orange-500 dark:text-orange-400'
  return 'text-red-500 dark:text-red-400'
}

// Temperature band hex colors for Recharts scatter dots (cold=blue -> hot=red)
// These represent physical reality and are intentionally accent-independent.
export const TEMP_BAND_COLORS = {
  cold:      c.blue400,    // < 10 °C
  cool:      c.emerald400, // 10-18 °C
  mild:      c.amber400,   // 18-24 °C
  warm:      c.orange500,  // 24-30 °C
  hot:       c.red500,     // >= 30 °C
} as const

export function tempBandColor(celsius: number): string {
  if (celsius < 10) return TEMP_BAND_COLORS.cold
  if (celsius < 18) return TEMP_BAND_COLORS.cool
  if (celsius < 24) return TEMP_BAND_COLORS.mild
  if (celsius < 30) return TEMP_BAND_COLORS.warm
  return TEMP_BAND_COLORS.hot
}
