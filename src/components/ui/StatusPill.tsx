import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export type StatusTone = 'accent' | 'blue' | 'amber' | 'red' | 'zinc' | 'green' | 'emerald'

// C3: single recipe for every status pastille (training status trend,
// consistency rating, week load level...) - translucent tinted background,
// bright tinted text, tight radius/padding. Only the tint varies by tone.
// Use 'emerald' (not 'accent') for semantic success states - emerald is fixed,
// 'accent' follows the user's accent picker.
const TONE_CLASS: Record<StatusTone, string> = {
  accent:  'bg-accent/[0.14] text-accent-text',
  blue:    'bg-blue-500/[0.14] text-blue-600 dark:text-blue-400',
  amber:   'bg-amber-500/[0.14] text-amber-600 dark:text-amber-400',
  red:     'bg-red-500/[0.14] text-red-600 dark:text-red-400',
  zinc:    'bg-zinc-400/[0.14] text-zinc-600 dark:text-zinc-400',
  green:   'bg-green-500/[0.14] text-green-700 dark:text-green-400',
  emerald: 'bg-emerald-500/[0.14] text-emerald-700 dark:text-emerald-400',
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
