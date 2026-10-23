'use client'

import { createContext, forwardRef, useCallback, useRef, type ReactNode } from 'react'
import { useStuck } from '@/lib/useStuck'
import { cn } from '@/lib/utils'

export const StickyStuckContext = createContext<boolean | null>(null)

/**
 * Opaque from lg up rather than glass: content would read through the tab labels, and blur can't be relied on.
 * No data-sticky-strip: a scroll edge grown by its height would paint the ground behind the pinned glass.
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
