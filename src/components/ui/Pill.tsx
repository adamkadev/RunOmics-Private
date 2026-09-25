import { cn } from '@/lib/utils'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'

/**
 * `accent` is the one and only "selected" treatment - a filled accent pill.
 * There used to be a second one (`active`, a neutral 14 % foreground tint) so
 * the Activities filter row and the profile period toggle read as selected in a
 * different language from the year and window pickers. `neutral` is everything
 * unselected.
 *
 * `onDark` is the same geometry for the two surfaces that stay dark in both
 * themes - the Today hero card and the planned-workout sheet, both of which set
 * `text-white` outright. `foreground` is the wrong ink there: in light mode
 * `neutral` would paint near-black text on a near-black glass. It mirrors the
 * existing `--accent-on-dark` token rather than introducing a second geometry.
 */
type PillVariant = 'accent' | 'neutral' | 'onDark'

const VARIANT_CLASS: Record<PillVariant, string> = {
  accent:  'border border-transparent bg-accent text-accent-foreground font-semibold shadow-sm',
  neutral: 'border border-foreground/[0.12] bg-foreground/[0.06] text-foreground/60 hover:bg-foreground/[0.10]',
  onDark:  'border border-white/[0.12] bg-white/[0.10] text-white/80 font-semibold',
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
