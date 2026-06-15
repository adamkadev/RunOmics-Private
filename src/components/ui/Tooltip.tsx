import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-52 -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground/80 shadow-md opacity-0 transition-opacity group-hover/tip:opacity-100">
        {content}
      </span>
    </span>
  )
}
