import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The one eyebrow recipe (G20, v4.17), for status lines: Liquid Glass v3's
 * 12/16 caps at 600 and +0.06em.
 */
export const EYEBROW_CLASS = 'text-eyebrow uppercase'

/**
 * The two label levels the app actually has. Before these existed the same job
 * was done by five inline uppercase recipes plus a CSS class, and three separate
 * title-case recipes, so the same card name changed casing between pages.
 *
 * SectionDivider separates cards: iOS's inset-grouped section label (Liquid
 * Glass v3), 13/18 at 600 in sentence case, 16 pt in to line up with the
 * cards' text. CardTitle names one card's own content: the 17/22 headline.
 */
export function SectionDivider({
  as: Tag = 'div',
  children,
  className,
}: {
  as?: 'h2' | 'h3' | 'p' | 'div' | 'span'
  children: ReactNode
  className?: string
}) {
  return (
    // Between cards it has nothing around it, so the compact title bar fades
    // it before its divider rather than cut it (design review, Oct 2026).
    <Tag data-bar-fade className={cn('px-4 text-[13px] font-semibold leading-[18px] tracking-[-0.005rem] text-muted-foreground', className)}>
      {children}
    </Tag>
  )
}

export function CardTitle({
  as: Tag = 'h3',
  children,
  className,
}: {
  as?: 'h2' | 'h3' | 'div' | 'span'
  children: ReactNode
  className?: string
}) {
  return <Tag className={cn('text-headline text-foreground', className)}>{children}</Tag>
}
