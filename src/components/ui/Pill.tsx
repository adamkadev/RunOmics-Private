import { cn } from '@/lib/utils'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'

/**
 * `accent` is the one and only "selected" treatment - the neutral raised pill
 * of the segmented control (the name stays; the accent itself is for data).
 * There used to be a second one (`active`, a neutral 14 % foreground tint) so
 * the Activities filter row and the profile period toggle read as selected in a
 * different language from the year and window pickers. `neutral` is everything
 * unselected.
 */
type PillVariant = 'accent' | 'neutral'

const VARIANT_CLASS: Record<PillVariant, string> = {
  // Selected: the segmented control's neutral pill (neutral surfaces).
  accent:  'border border-transparent bg-[var(--segmented-pill)] text-foreground font-semibold shadow-[var(--segmented-pill-shadow)]',
  neutral: 'border border-[var(--divider)] bg-transparent text-muted-foreground hover:text-foreground',
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
        'inline-flex flex-none items-center gap-1.5 rounded-full px-3.5 py-[7px] text-xs font-medium',
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
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden="true"
        />
      )}
      {children as ReactNode}
    </Tag>
  )
}
