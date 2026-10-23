import { cn } from '@/lib/utils'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'

/** `selected` is inverted ink, never the accent: the accent is for the athlete's own data and real actions. */
type PillVariant = 'selected' | 'neutral' | 'onAura'

const VARIANT_CLASS: Record<PillVariant, string> = {
  selected: 'bg-foreground px-4 text-background font-semibold',
  neutral:  'bg-[var(--fill-3)] text-foreground font-medium',
  // Unselected, straight on the background glow.
  onAura:   'on-aura text-foreground font-medium',
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
  // A plain span is a label; a hit area would only steal taps from its neighbours.
  const interactive = Tag !== 'span' || rest.onClick !== undefined
  return (
    <Tag
      className={cn(
        'inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-3.5 text-[15px] tracking-[-0.015rem]',
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
