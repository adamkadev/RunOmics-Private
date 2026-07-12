// Hex colors for Recharts (cannot use Tailwind classes in SVG attributes)
export const CHART_COLORS = {
  // Brand / primary metric
  brand:     '#1ed787', // emerald (dark-mode accent)

  // Training load
  ctl:       '#3b82f6', // blue-500   - fitness (chronic)
  atl:       '#f97316', // orange-500 - fatigue (acute)
  tsb:       '#1ed787', // emerald - form (balance)

  // Activity metrics
  hr:            '#ef4444', // red-500
  hrEasy:        '#fca5a5', // red-300
  pace:          '#3b82f6', // blue-500
  elevation:     '#a1662f', // rust-brown (bumped chroma from stone-500, which read as gray in the categorical set)
  cadence:       '#0ea5e9', // sky-500
  efficiency:    '#8b5cf6', // violet-500

  // Running form
  groundContact:       '#f59e0b', // amber-500
  verticalOscillation: '#f43f5e', // rose-500
  strideLength:        '#14b8a6', // teal-500

  // Easy / Hard split
  easy:      '#34d399', // emerald-400
  hard:      '#fb923c', // orange-400

  // Long run bar
  longRun: '#1ed787', // emerald

  // Chart decoration - muted floor kept at #8a978f/#a8b4ae so axis/legend
  // text clears WCAG contrast against the dark-mode #060a08 background.
  axisTick:        '#a8b4ae',
  referenceLine:   '#e5e7eb', // gray-200
  referenceTarget: '#8a978f',
  tooltipCursor:   'rgba(168,180,174,0.12)',
} as const

// HR zone colors (Z1-Z5), keyed by zone number
export const ZONE_COLORS: Record<number, string> = {
  1: '#9ca3af', // gray-400
  2: '#60a5fa', // blue-400
  3: '#34d399', // emerald-400
  4: '#f97316', // orange-500
  5: '#ef4444', // red-500
}

// HR zone Tailwind classes (light/dark), keyed by zone number. Shared between
// ZoneBar (activity detail) and ProfileHrZones (settings) - kept in sync here
// rather than duplicated, since they style the same Z1-Z5 scale.
export const ZONE_COLOR_CLASSES: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-[#a7b1aa] dark:bg-white/55',  text: 'text-[#a7b1aa] dark:text-white/55' },
  2: { bg: 'bg-[#3b82f6] dark:bg-[#7db8ff]', text: 'text-[#3b82f6] dark:text-[#7db8ff]' },
  3: { bg: 'bg-[#0e9f6e] dark:bg-[#4fe6a0]', text: 'text-[#0e9f6e] dark:text-[#4fe6a0]' },
  4: { bg: 'bg-[#f1761f] dark:bg-[#ff9a5a]', text: 'text-[#f1761f] dark:text-[#ff9a5a]' },
  5: { bg: 'bg-[#ff7676]',                   text: 'text-[#ff7676]' },
}

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

// Cold -> hot icon color scale for temperature readings
export function temperatureIconColor(celsius: number): string {
  if (celsius < 5)  return 'text-blue-500 dark:text-blue-400'
  if (celsius < 12) return 'text-cyan-500 dark:text-cyan-400'
  if (celsius < 18) return 'text-accent-text'
  if (celsius < 24) return 'text-amber-500 dark:text-amber-400'
  if (celsius < 30) return 'text-orange-500 dark:text-orange-400'
  return 'text-red-500 dark:text-red-400'
}

// Activity map route gradient (pace-based), thresholds (sec/km) calibrated on
// this athlete's actual pace distribution (median ~5:52/km, p90 ~7:10/km) rather
// than generic splits - so the gradient actually spans most real segments instead
// of sitting mostly in one or two colors. Ends reuse CHART_COLORS.hr/brand/pace
// so the map stays visually consistent with the HR/training-load/pace charts.
export const PACE_ROUTE_COLORS = {
  fast:      CHART_COLORS.hr,    // <= 4:15/km - intervals, race pace
  tempo:     '#f59e0b',          //    5:00/km - amber-500
  steady:    '#84cc16',          //    5:50/km - lime-500, near median pace
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
  rare:     CHART_COLORS.pace,                // #3b82f6 blue-500   - run once
  seldom:   CHART_COLORS.efficiency,          // #8b5cf6 violet-500
  often:    CHART_COLORS.verticalOscillation, // #f43f5e rose-500
  frequent: CHART_COLORS.hr,                  // #ef4444 red-500    - run most often
} as const

// Temperature band hex colors for Recharts scatter dots (cold=blue -> hot=red)
// These represent physical reality and are intentionally accent-independent.
export const TEMP_BAND_COLORS = {
  cold:      '#60a5fa', // blue-400  (< 10 °C)
  cool:      '#34d399', // emerald-400 (10-18 °C)
  mild:      '#fbbf24', // amber-400  (18-24 °C)
  warm:      '#f97316', // orange-500 (24-30 °C)
  hot:       '#ef4444', // red-500    (>= 30 °C)
} as const

export function tempBandColor(celsius: number): string {
  if (celsius < 10) return TEMP_BAND_COLORS.cold
  if (celsius < 18) return TEMP_BAND_COLORS.cool
  if (celsius < 24) return TEMP_BAND_COLORS.mild
  if (celsius < 30) return TEMP_BAND_COLORS.warm
  return TEMP_BAND_COLORS.hot
}
