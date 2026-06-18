import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export const CARD_ACCENT: Record<string, string> = {
  emerald: 'border-l-4 border-l-emerald-400 dark:border-l-emerald-500',
  blue:    'border-l-4 border-l-blue-400 dark:border-l-blue-500',
  amber:   'border-l-4 border-l-amber-400 dark:border-l-amber-500',
  violet:  'border-l-4 border-l-violet-400 dark:border-l-violet-500',
  rose:    'border-l-4 border-l-rose-400 dark:border-l-rose-500',
  orange:  'border-l-4 border-l-orange-400 dark:border-l-orange-500',
  red:     'border-l-4 border-l-red-400 dark:border-l-red-500',
  cyan:    'border-l-4 border-l-cyan-400 dark:border-l-cyan-500',
  fuchsia: 'border-l-4 border-l-fuchsia-400 dark:border-l-fuchsia-500',
  purple:  'border-l-4 border-l-purple-400 dark:border-l-purple-500',
  yellow:  'border-l-4 border-l-yellow-400 dark:border-l-yellow-500',
  green:   'border-l-4 border-l-green-400 dark:border-l-green-500',
}

export const CARD_ACCENT_LABEL: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  blue:    'text-blue-600 dark:text-blue-400',
  amber:   'text-amber-600 dark:text-amber-400',
  violet:  'text-violet-600 dark:text-violet-400',
  rose:    'text-rose-600 dark:text-rose-400',
  orange:  'text-orange-600 dark:text-orange-400',
  red:     'text-red-600 dark:text-red-400',
  cyan:    'text-cyan-600 dark:text-cyan-400',
  fuchsia: 'text-fuchsia-600 dark:text-fuchsia-400',
  purple:  'text-purple-600 dark:text-purple-400',
  yellow:  'text-yellow-600 dark:text-yellow-400',
  green:   'text-green-600 dark:text-green-400',
}

interface CardOptions {
  accent?: string
  padding?: 'none' | 'sm' | 'base' | 'lg'
  clickable?: boolean
  dashed?: boolean
  overflow?: boolean
  className?: string
}

export function cardClass({
  accent,
  padding = 'base',
  clickable,
  dashed,
  overflow,
  className,
}: CardOptions = {}): string {
  return cn(
    'rounded-xl border border-border bg-card shadow-card',
    padding === 'sm'   && 'p-3',
    padding === 'base' && 'p-4',
    padding === 'lg'   && 'p-5',
    overflow && 'overflow-hidden',
    accent && CARD_ACCENT[accent],
    clickable && 'transition-shadow hover:shadow-md',
    dashed && 'border-dashed',
    className
  )
}

interface CardProps extends CardOptions {
  children: ReactNode
}

export function Card({ children, ...opts }: CardProps) {
  return <div className={cardClass(opts)}>{children}</div>
}
