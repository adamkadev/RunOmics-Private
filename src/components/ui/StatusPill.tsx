import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export type StatusTone = 'accent' | 'blue' | 'amber' | 'red' | 'zinc' | 'green' | 'emerald' | 'good' | 'warn' | 'neutral'

const TONE_CLASS: Record<StatusTone, string> = {
  accent:  'bg-accent/[0.14] text-accent-text',
  blue:    'bg-blue-500/[0.14] text-blue-600 dark:text-blue-400',
  amber:   'bg-amber-500/[0.14] text-amber-600 dark:text-amber-400',
  red:     'bg-red-500/[0.14] text-red-600 dark:text-red-400',
  zinc:    'bg-zinc-400/[0.14] text-zinc-600 dark:text-zinc-400',
  green:   'bg-green-500/[0.14] text-green-700 dark:text-green-400',
  emerald: 'bg-emerald-500/[0.14] text-emerald-700 dark:text-emerald-400',
  // Session states, on the theme's own delta tokens.
  good:    'bg-delta-good/15 text-delta-good',
  warn:    'bg-delta-warn/15 text-delta-warn',
  neutral: 'bg-foreground/[0.06] text-subtle',
}

export function StatusPill({ tone, className, children }: { tone: StatusTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-[7px] px-2 py-[3px] text-xs font-medium',
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
