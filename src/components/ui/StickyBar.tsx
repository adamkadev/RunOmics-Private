'use client'

import { createContext, forwardRef, useCallback, useRef, type ReactNode } from 'react'
import { useStuck } from '@/lib/useStuck'
import { cn } from '@/lib/utils'

/** Whether the strip around a control is pinned: a segmented control in it turns to glass. */
export const StickyStuckContext = createContext<boolean | null>(null)

/**
 * A sticky strip of controls - the Analytics and activity tabs. Opaque, on the
 * page's own background, with a hairline and a 12 pt fade into the content:
 * the glass fill let axis labels and "Stride length 1.06" read through the tab
 * labels, and blur can't be relied on (the reason the status bar went opaque).
 * Its `top` reads --sticky-top first: while the compact title bar shows, the
 * strip sits under it rather than over its title (v4.3.3). Then, on a phone,
 * --sticky-alone, which keeps it from sticking on its own (globals.css).
 * On a phone it is transparent (Liquid Glass v2), at z-30 over the soft
 * scroll edge. Pinned, the segmented control in it turns to glass (Liquid
 * Glass v3, G5), fading in over 120 ms, and the rows pass visibly under it
 * (F20): the strip is no data-sticky-strip, so the scroll edge stays the
 * bar's own. Grown by the strip's height (F4), the edge painted the ground
 * behind the glass, which read as a flat grey track. Activities' month
 * headings, plain text, still grow it.
 */
export const StickyBar = forwardRef<HTMLDivElement, { top: string; className?: string; children: ReactNode }>(
  function StickyBar({ top, className, children }, ref) {
    const inner = useRef<HTMLDivElement | null>(null)
    const stuck = useStuck(inner)
    const setRef = useCallback(
      (el: HTMLDivElement | null) => {
        inner.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      },
      [ref],
    )
    return (
      <div
        ref={setRef}
        data-stuck={stuck ? '' : undefined}
        data-testid="sticky-bar"
        style={{ top }}
        className={cn(
          'sticky z-30 -mx-4 border-b border-border bg-background px-4 py-2 sm:-mx-6 sm:px-6 max-lg:border-b-0 max-lg:bg-transparent',
          "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-gradient-to-b after:from-background after:to-transparent after:content-[''] max-lg:after:hidden",
          className,
        )}
      >
        <StickyStuckContext.Provider value={stuck}>{children}</StickyStuckContext.Provider>
      </div>
    )
  },
)
