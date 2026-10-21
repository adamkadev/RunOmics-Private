import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A sticky strip of controls - the Analytics and activity tabs. Opaque, on the
 * page's own background, with a hairline and a 12 pt fade into the content:
 * the glass fill let axis labels and "Stride length 1.06" read through the tab
 * labels, and blur can't be relied on (the reason the status bar went opaque).
 * Its `top` reads --sticky-top first: while the compact title bar shows, the
 * strip sits under it rather than over its title (v4.3.3). Then, on a phone,
 * --sticky-alone, which keeps it from sticking on its own (globals.css).
 * On a phone it is transparent (Liquid Glass v2): its text stays sharp at
 * z-30 over the soft scroll edge, which grows by its height while it is
 * stuck (data-sticky-strip, --sticky-h), and the rows dissolve under it.
 */
export const StickyBar = forwardRef<HTMLDivElement, { top: string; className?: string; children: ReactNode }>(
  function StickyBar({ top, className, children }, ref) {
    return (
      <div
        ref={ref}
        data-testid="sticky-bar"
        data-sticky-strip
        style={{ top }}
        className={cn(
          'sticky z-30 -mx-4 border-b border-border bg-background px-4 py-2 sm:-mx-6 sm:px-6 max-lg:border-b-0 max-lg:bg-transparent',
          "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-gradient-to-b after:from-background after:to-transparent after:content-[''] max-lg:after:hidden",
          className,
        )}
      >
        {children}
      </div>
    )
  },
)
