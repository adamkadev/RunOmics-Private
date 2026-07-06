'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { tooltipSurfaceClass } from '@/components/ui/Card'

const TOOLTIP_WIDTH_PX = 208 // w-52
const VIEWPORT_MARGIN_PX = 12

export function Tooltip({
  children,
  content,
  className,
  surfaceClassName,
}: {
  children: ReactNode
  content: string
  className?: string
  surfaceClassName?: string
}) {
  const id = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [shiftPx, setShiftPx] = useState(0)

  useEffect(() => {
    function reposition() {
      const el = triggerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const center = rect.left + rect.width / 2
      const halfWidth = TOOLTIP_WIDTH_PX / 2
      const overflowLeft = halfWidth + VIEWPORT_MARGIN_PX - center
      const overflowRight = center + halfWidth + VIEWPORT_MARGIN_PX - window.innerWidth
      if (overflowLeft > 0) setShiftPx(overflowLeft)
      else if (overflowRight > 0) setShiftPx(-overflowRight)
      else setShiftPx(0)
    }
    reposition()
    window.addEventListener('resize', reposition)
    return () => window.removeEventListener('resize', reposition)
  }, [])

  return (
    <span
      ref={triggerRef}
      tabIndex={0}
      aria-describedby={id}
      className={cn(
        'group/tip relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded',
        className
      )}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        style={{ transform: `translateX(calc(-50% + ${shiftPx}px))` }}
        className={cn(tooltipSurfaceClass, surfaceClassName, 'pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-52 text-foreground/80 opacity-0 transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100')}
      >
        {content}
      </span>
    </span>
  )
}
