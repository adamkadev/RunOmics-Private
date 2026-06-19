import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { tooltipSurfaceClass } from '@/components/ui/Card'

export function Tooltip({
  children,
  content,
  className,
}: {
  children: ReactNode
  content: string
  className?: string
}) {
  return (
    <span className={cn('group/tip relative cursor-help', className)}>
      {children}
      <span className={cn(tooltipSurfaceClass, 'pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-52 -translate-x-1/2 text-foreground/80 opacity-0 transition-opacity group-hover/tip:opacity-100')}>
        {content}
      </span>
    </span>
  )
}
