import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export type StatusTone = 'accent' | 'blue' | 'amber' | 'red' | 'zinc' | 'green' | 'emerald' | 'good' | 'warn' | 'neutral'

// A neutral chip with the tone in its text only: no tinted fills.
const TONE_CLASS: Record<StatusTone, string> = {
  accent:  'text-accent-text',
  blue:    'text-[var(--zone-2)]',
  amber:   'text-[var(--tone-caution)]',
  red:     'text-destructive',
  zinc:    'text-muted-foreground',
  green:   'text-delta-good',
  emerald: 'text-delta-good',
  good:    'text-delta-good',
  warn:    'text-delta-warn',
  neutral: 'text-subtle',
}

export function StatusPill({ tone, className, children }: { tone: StatusTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-[7px] bg-[var(--track)] px-2 py-[3px] text-xs font-medium',
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
