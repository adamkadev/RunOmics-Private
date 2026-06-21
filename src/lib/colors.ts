// Hex colors for Recharts (cannot use Tailwind classes in SVG attributes)
export const CHART_COLORS = {
  // Brand / primary metric
  brand:     '#10b981', // emerald-500

  // Training load
  ctl:       '#3b82f6', // blue-500   - fitness (chronic)
  atl:       '#f97316', // orange-500 - fatigue (acute)
  tsb:       '#10b981', // emerald-500 - form (balance)

  // Activity metrics. The `*Light` shades are the same hue, used for the
  // second activity when overlaying 2 series in activity comparison charts.
  hr:            '#ef4444', // red-500
  hrEasy:        '#fca5a5', // red-300
  pace:          '#3b82f6', // blue-500
  paceLight:     '#93c5fd', // blue-300
  elevation:     '#78716c', // stone-500
  elevationLight:'#d6d3d1', // stone-300
  cadence:       '#0ea5e9', // sky-500
  cadenceLight:  '#7dd3fc', // sky-300
  efficiency:    '#8b5cf6', // violet-500

  // Running form
  groundContact:       '#f59e0b', // amber-500
  verticalOscillation: '#f43f5e', // rose-500
  strideLength:        '#14b8a6', // teal-500

  // Generic activity identity (summary cards / table, not tied to a metric)
  compareA: '#3b82f6', // blue-500
  compareB: '#f97316', // orange-500

  // Easy / Hard split
  easy:      '#34d399', // emerald-400
  hard:      '#fb923c', // orange-400

  // Long run bar
  longRun: '#10b981', // emerald-500

  // Chart decoration
  axisTick:        '#9ca3af', // gray-400
  referenceLine:   '#e5e7eb', // gray-200
  referenceTarget: '#6b7280', // gray-500
  tooltipCursor:   'rgba(156,163,175,0.1)',
} as const

// HR zone colors (Z1-Z5), keyed by zone number
export const ZONE_COLORS: Record<number, string> = {
  1: '#9ca3af', // gray-400
  2: '#60a5fa', // blue-400
  3: '#34d399', // emerald-400
  4: '#f97316', // orange-500
  5: '#ef4444', // red-500
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
