import { cn } from '@/lib/utils'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'

type PillVariant = 'active' | 'neutral' | 'highlight'

// `highlight` carries its tint via className (semantic, semi-transparent).
// Pills are rendered in long scrollable rows, so they stay solid - no
// backdrop-filter (the blur budget is reserved for chrome + key cards).
const VARIANT_CLASS: Record<PillVariant, string> = {
  active: 'bg-accent text-accent-foreground font-semibold',
  neutral: 'border border-border bg-muted text-muted-foreground hover:bg-muted/70',
  highlight: 'border font-semibold',
}

interface PillProps extends HTMLAttributes<HTMLElement> {
  variant?: PillVariant
  as?: ElementType
  /** Type pastille: a small colored dot before the label. */
  dotColor?: string
}

export function Pill({
  variant = 'neutral',
  as: Tag = 'span',
  dotColor,
  className,
  children,
  ...rest
}: PillProps) {
  return (
    <Tag
      className={cn(
        'inline-flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
        'whitespace-nowrap transition-transform active:scale-95',
        VARIANT_CLASS[variant],
        className
      )}
      {...rest}
    >
      {dotColor && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden="true"
        />
      )}
      {children as ReactNode}
    </Tag>
  )
}
