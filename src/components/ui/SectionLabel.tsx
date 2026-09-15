import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The two label levels the app actually has. Before these existed the same job
 * was done by five inline uppercase recipes plus a CSS class, and three separate
 * title-case recipes, so the same card name changed casing between pages.
 *
 * SectionDivider separates cards. CardTitle names one card's own content.
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
    <Tag className={cn('text-caption font-semibold uppercase tracking-wider text-muted-foreground', className)}>
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
  return <Tag className={cn('text-sm font-semibold text-foreground/80', className)}>{children}</Tag>
}
