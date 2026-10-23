import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A label, not a card, so the tint is allowed. */
export function OutcomePill({ children, tone, className }: { children: ReactNode; tone: 'pos' | 'neg'; className?: string }) {
  return (
    <span
      data-tone={tone}
      className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold', className)}
      style={{ background: `color-mix(in srgb, var(--${tone}) 16%, transparent)`, color: `var(--${tone})` }}
    >
      {children}
    </span>
  )
}
