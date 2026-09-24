import { cn } from '@/lib/utils'

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
    padding === 'sm'   && 'p-3',
    padding === 'base' && 'p-4',
    padding === 'lg'   && 'p-5',
    overflow  && 'overflow-hidden',
    clickable && 'cursor-pointer transition-shadow hover:shadow-md',
    dashed    && 'border-dashed',
    className
  )
}

export const tooltipSurfaceClass = 'rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-md'
