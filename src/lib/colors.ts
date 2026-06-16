// Hex colors for Recharts (cannot use Tailwind classes in SVG attributes)
export const CHART_COLORS = {
  // Brand / primary metric
  brand:      '#10b981', // emerald-500

  // Training load
  ctl:        '#3b82f6', // blue-500   - fitness (chronic)
  atl:        '#f97316', // orange-500 - fatigue (acute)
  tsb:        '#10b981', // emerald-500 - form (balance)

  // Activity metrics
  hr:         '#ef4444', // red-500
  pace:       '#3b82f6', // blue-500
  elevation:  '#78716c', // stone-500
  cadence:    '#0ea5e9', // sky-500
  efficiency: '#8b5cf6', // violet-500

  // Easy / Hard split
  easy:       '#34d399', // emerald-400
  hard:       '#fb923c', // orange-400

  // Long runs tiers
  longRun10:  '#6ee7b7', // emerald-200
  longRun15:  '#059669', // emerald-600

  // Chart decoration
  axisTick:        '#9ca3af', // gray-400
  referenceLine:   '#e5e7eb', // gray-200
  referenceTarget: '#6b7280', // gray-500 (dashed target lines)
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

// Tailwind class pairs [light, dark] for UI components
export const STAT_COLORS = {
  distance:  { icon: 'text-emerald-600 dark:text-emerald-400' },
  time:      { icon: 'text-blue-500    dark:text-blue-400'    },
  heartRate: { icon: 'text-red-500     dark:text-red-400'     },
  pace:      { icon: 'text-blue-500    dark:text-blue-400'    },
  streak:    { icon: 'text-orange-500  dark:text-orange-400'  },
  vo2max:    { icon: 'text-violet-500  dark:text-violet-400'  },
} as const
