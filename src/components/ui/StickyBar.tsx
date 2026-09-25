import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A sticky strip of controls - the Analytics and activity tabs. Opaque, on the
 * page's own background, with a hairline and a 12 pt fade into the content:
 * the glass fill let axis labels and "Stride length 1.06" read through the tab
 * labels, and blur can't be relied on (the reason the status bar went opaque).
 */
export const StickyBar = forwardRef<HTMLDivElement, { top: string; className?: string; children: ReactNode }>(
  function StickyBar({ top, className, children }, ref) {
    return (
      <div
        ref={ref}
        data-testid="sticky-bar"
        style={{ top }}
        className={cn(
          'sticky z-30 -mx-4 border-b border-border bg-background px-4 py-2 sm:-mx-6 sm:px-6',
          "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-gradient-to-b after:from-background after:to-transparent after:content-['']",
          className,
        )}
      >
        {children}
      </div>
    )
  },
)
