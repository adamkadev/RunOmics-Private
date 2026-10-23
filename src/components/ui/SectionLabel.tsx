import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const EYEBROW_CLASS = 'text-eyebrow uppercase'

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
    // data-bar-fade: nothing surrounds it, so the compact title bar fades it rather than cut it.
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
