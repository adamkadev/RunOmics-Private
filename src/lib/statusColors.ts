// Semantic status colors: fixed, independent of the accent/brand picker.
// Use these everywhere a status has universal meaning (success, in-progress, pending, warning, danger).
// Accent-colored elements (nav, CTAs, progress bars) stay in accent - only STATUS indicators go here.
export const STATUS = {
  success: {
    text:  'text-emerald-600 dark:text-emerald-400',
    bg:    'bg-emerald-50 dark:bg-emerald-900/30',
    dot:   'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  progress: {
    text:  'text-blue-600 dark:text-blue-400',
    bg:    'bg-blue-50 dark:bg-blue-900/30',
    dot:   'bg-blue-500',
    badge: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  pending: {
    text:  'text-zinc-500 dark:text-zinc-400',
    bg:    'bg-zinc-100 dark:bg-zinc-800',
    dot:   'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  },
  warning: {
    text:  'text-amber-600 dark:text-amber-400',
    bg:    'bg-amber-50 dark:bg-amber-900/30',
    dot:   'bg-amber-500',
    badge: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  danger: {
    text:  'text-red-700 dark:text-red-400',
    bg:    'bg-red-50 dark:bg-red-900/30',
    dot:   'bg-red-500',
    badge: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  },
  gold:   { text: 'text-amber-500 dark:text-amber-400', dot: 'bg-amber-400 dark:bg-amber-400' },
  silver: { text: 'text-slate-400 dark:text-slate-300', dot: 'bg-slate-300 dark:bg-slate-300' },
  bronze: { text: 'text-amber-700 dark:text-amber-600', dot: 'bg-amber-700 dark:bg-amber-600' },
} as const
