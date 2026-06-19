import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface CardOptions {
  padding?: 'none' | 'sm' | 'base' | 'lg'
  clickable?: boolean
  dashed?: boolean
  overflow?: boolean
  className?: string
}

export function cardClass({
  padding = 'base',
  clickable,
  dashed,
  overflow,
  className,
}: CardOptions = {}): string {
  return cn(
    'rounded-xl border border-border bg-card shadow-card',
    'border-l-4 border-l-accent-text/70',
    padding === 'sm'   && 'p-3',
    padding === 'base' && 'p-4',
    padding === 'lg'   && 'p-5',
    overflow  && 'overflow-hidden',
    clickable && 'cursor-pointer transition-shadow hover:shadow-md',
    dashed    && 'border-dashed',
    className
  )
}

interface CardProps extends CardOptions {
  children: ReactNode
}

export function Card({ children, ...opts }: CardProps) {
  return <div className={cardClass(opts)}>{children}</div>
}

/** Inline status/label chip. Pass className for bg + text color. */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  )
}
