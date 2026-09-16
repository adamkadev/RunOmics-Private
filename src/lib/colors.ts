import { HUE, ink, paper, white, withAlpha } from '@/lib/palette'

const c = HUE

export const CHART_COLORS = {
  brand:     c.roEmerald,

  ctl:       c.blue500,
  atl:       c.orange500,

  hr:            c.red500,
  hrEasy:        c.red300,
  pace:          c.blue500,
  elevation:     c.roRust,
  cadence:       c.sky500,
  efficiency:    c.violet500,

  groundContact:       c.amber500,
  verticalOscillation: c.rose500,
  verticalRatio:       c.fuchsia500,
  strideLength:        c.teal500,

  easy:      c.emerald400,
  hard:      c.orange400,

  axisTick:        c.roInkInv2,
  referenceLine:   c.gray200,
  referenceTarget: c.roInkInv3,
  tooltipCursor:   withAlpha(c.roInkInv2, 0.12),
} as const

export const TRAINING_STATUS_COLORS: Record<string, string> = {
  fresh:        c.violet500,
  productive:   c.emerald400,
  maintaining:  c.yellow500,
  recovery:     c.blue600,
  unproductive: c.orange500,
  detraining:   c.zinc400,
  overreaching: c.red500,
}

export const TRAINING_PLAN_PHASE_COLORS: Record<string, string> = {
  base:    c.roEmerald,
  build:   c.blue500,
  peak:    c.violet500,
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

export const ZONE_COLOR_CLASSES: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-[var(--zone-1)]', text: 'text-[var(--zone-1)]' },
  2: { bg: 'bg-[var(--zone-2)]', text: 'text-[var(--zone-2)]' },
  3: { bg: 'bg-[var(--zone-3)]', text: 'text-[var(--zone-3)]' },
  4: { bg: 'bg-[var(--zone-4)]', text: 'text-[var(--zone-4)]' },
  5: { bg: 'bg-[var(--zone-5)]', text: 'text-[var(--zone-5)]' },
}

// A rising metric is not automatically good news: fatigue climbing is a warning,
// fitness climbing is not. Each tile says which direction it wants.
export const METRIC_DELTA_COLORS = {
  good: 'var(--delta-good)',
  warn: 'var(--delta-warn)',
  flat: 'var(--subtle)',
} as const

export type MetricDeltaPolarity = 'up' | 'down'

export function metricDeltaColor(delta: number, goodWhen: MetricDeltaPolarity, threshold: number): string {
  if (Math.abs(delta) <= threshold) return METRIC_DELTA_COLORS.flat
  const rising = delta > 0
  return rising === (goodWhen === 'up') ? METRIC_DELTA_COLORS.good : METRIC_DELTA_COLORS.warn
}

export const READINESS_TONE_COLORS = {
  go:      c.roEmerald,
  caution: c.roAmber,
  hold:    c.red500,
} as const

export const GOAL_PACE_COLORS = {
  ahead:   { bg: 'color-mix(in srgb, var(--accent) 6%, transparent)', border: 'color-mix(in srgb, var(--accent) 25%, transparent)', bar: 'var(--accent)' },
  onTrack: { bg: withAlpha(c.roBlueMid, 0.1),   border: withAlpha(c.roBlueMid, 0.28), bar: c.roBlueHi },
  // Amber, not pink: the behind state is also drawn as an amber icon and an amber
  // label in the same card, and `--color-missed` pink is Plan's missed-session hue.
  behind:  { bg: withAlpha(c.amber500, 0.06),   border: withAlpha(c.amber500, 0.25),  bar: c.amber500 },
  pending: { bg: '',                            border: '',                           bar: 'var(--track-on-dark)' },
} as const

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

export const WORKOUT_SEGMENT_COLORS = {
  warmup:   paper(0.18),
  effort:   c.roAmber,
  recovery: c.blue500,
  cooldown: paper(0.18),
} as const

export const WORKOUT_SHEET_COLORS = {
  base: withAlpha(c.sheetInk, 0.82),
  baseTinted: withAlpha(c.sheetInk, 0.88),
  border: paper(0.08),
  handle: paper(0.2),
  iconWell: paper(0.07),
  iconFallback: c.gray400,
  tint: { fill: 0.12, border: 0.27, handle: 0.33, iconWell: 0.1 },
} as const

export const CELEBRATION_COLORS = {
  confetti: [c.green400, c.amber400, c.cyan300, c.pink400] as const,
  burst:    `radial-gradient(circle, ${c.green500}, ${c.green700})`,
  burstGlow: `0 0 50px ${withAlpha(c.green500, 0.5)}`,
} as const

export const BRAND_TINTS = {
  headlineBorder: withAlpha(c.roEmerald, 0.32),
  headlineFill: `linear-gradient(158deg, ${withAlpha(c.roEmerald, 0.11)}, ${withAlpha(c.roEmerald, 0.02)})`,
  footerFill: `linear-gradient(155deg, ${withAlpha(c.roEmerald, 0.08)}, transparent)`,
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

export const PACE_ROUTE_COLORS = {
  fast:      CHART_COLORS.hr,
  tempo:     c.amber500,
  steady:    c.lime500,
  easy:      CHART_COLORS.brand,
  recovery:  CHART_COLORS.pace,
} as const

export const HEAT_ROUTE_COLORS = {
  rare:     CHART_COLORS.pace,
  seldom:   CHART_COLORS.efficiency,
  often:    CHART_COLORS.verticalOscillation,
  frequent: CHART_COLORS.hr,
} as const

export const SHARE_BACKDROPS = {
  aurora:  [c.shareAuroraLight,  c.shareAuroraDark],
  pulse:   [c.sharePulseLight,   c.sharePulseDark],
  terrain: [c.shareTerrainLight, c.shareTerrainDark],
  prism:   [c.sharePrismLight,   c.sharePrismDark],
  map:     [c.shareMapLight,     c.shareMapDark],
} as const

export const SHARE_CARD_COLORS = {
  routeStart: c.green500,
  routeFinish: c.red500,
  mapLabelPlateDark:  withAlpha(c.shareMapDark, 0.76),
  mapLabelPlateLight: withAlpha(c.shareMapLight, 0.76),
  mapPillDark:  withAlpha(c.shareMapDark, 0.84),
  mapPillLight: paper(0.88),
  memoryDark:  [c.shareMemoryDark1, c.shareMemoryDark2, c.shareMemoryDark3, c.shareMemoryDark4] as const,
  memoryLight: [c.shareMemoryLight1, c.shareMemoryLight2, c.shareMemoryLight3, c.shareMemoryLight4] as const,
  memoryHorizonLight: withAlpha(c.shareMemoryHorizon, 0.48),
  toggleOff: withAlpha(c.iosFill, 0.22),
  thumbRingAlpha: 0.33,
  onAccent: white,
  customWheel: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
} as const

export const BOOT_COLORS = {
  background: c.performanceBgDark,
  foreground: c.gray200,
  actionBg: c.emerald500,
  actionFg: c.performanceBgDark,
  logo: c.emerald400,
} as const

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

export function temperatureIconColor(celsius: number): string {
  if (celsius < 5)  return 'text-blue-500 dark:text-blue-400'
  if (celsius < 12) return 'text-cyan-500 dark:text-cyan-400'
  if (celsius < 18) return 'text-accent-text'
  if (celsius < 24) return 'text-amber-500 dark:text-amber-400'
  if (celsius < 30) return 'text-orange-500 dark:text-orange-400'
  return 'text-red-500 dark:text-red-400'
}

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
