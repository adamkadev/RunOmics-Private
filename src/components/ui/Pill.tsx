import { cn } from '@/lib/utils'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'

/**
 * The filter chip (v4.17). `selected` is the one "selected" treatment: text
 * ink with the page ground as its label, inverted - the accent is for the
 * athlete's own data and real actions, not for a filter. `neutral` is
 * everything unselected: the surface, a line, text-2.
 */
type PillVariant = 'selected' | 'neutral'

const VARIANT_CLASS: Record<PillVariant, string> = {
  selected: 'border border-foreground bg-foreground text-background font-semibold',
  neutral:  'border border-border bg-card text-[var(--text-2)] hover:text-foreground',
}

interface PillProps extends HTMLAttributes<HTMLElement> {
  variant?: PillVariant
  as?: ElementType
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
  // A pill drawn at about 30 pt is a filter or a picker the thumb has to hit.
  // A plain span is a label, and its hit area would only steal taps from
  // whatever sits next to it.
  const interactive = Tag !== 'span' || rest.onClick !== undefined
  return (
    <Tag
      className={cn(
        'inline-flex h-8 flex-none items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium',
        interactive && 'hit-44',
        'whitespace-nowrap transition-transform active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        VARIANT_CLASS[variant],
        className
      )}
      {...rest}
    >
      {dotColor && (
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden="true"
        />
      )}
      {children as ReactNode}
    </Tag>
  )
}
