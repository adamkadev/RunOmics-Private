import { cn } from '@/lib/utils'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'

type PillVariant = 'active' | 'accent' | 'neutral' | 'highlight'

const VARIANT_CLASS: Record<PillVariant, string> = {
  active:    'border border-foreground/[0.20] bg-foreground/[0.14] text-foreground font-semibold',
  accent:    'border border-transparent bg-accent text-accent-foreground font-semibold shadow-sm',
  neutral:   'border border-foreground/[0.12] bg-foreground/[0.06] text-foreground/60 hover:bg-foreground/[0.10]',
  highlight: 'border font-semibold',
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
  return (
    <Tag
      className={cn(
        'inline-flex flex-none items-center gap-1.5 rounded-full px-3.5 py-[7px] text-xs font-medium',
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
