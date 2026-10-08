'use client'

import { useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

/** How far, after damping, a pull must travel before letting go starts it. */
export const PULL_THRESHOLD_PX = 64
/** Where the indicator stops following the finger. */
const PULL_MAX_PX = 96
/** The finger moves twice as far as the indicator: a pull should take intent. */
const PULL_DAMPING = 0.5

/**
 * Pull down at the top of Today to do what a tap on the sync line does
 * (design review, Oct 2026). The page never bounces - html sets
 * overscroll-behavior: none - so the gesture is read from the touches
 * alone, passively, and only a fixed indicator moves: nothing here can get
 * in the way of a scroll. The sync line stays the accessible control.
 */
export function PullToRefresh({ onPull, disabled = false }: { onPull: () => void; disabled?: boolean }) {
  const indicator = useRef<HTMLDivElement>(null)
  const latest = useRef({ onPull, disabled })
  useEffect(() => {
    latest.current = { onPull, disabled }
  })

  useEffect(() => {
    let start: { x: number; y: number } | null = null
    let armed = false

    const show = (distance: number) => {
      const el = indicator.current
      if (!el) return
      el.style.transition = 'none'
      el.style.opacity = String(Math.min(1, distance / PULL_THRESHOLD_PX))
      el.style.transform = `translate(-50%, ${distance}px) rotate(${distance * 3}deg)`
      el.dataset.armed = String(distance >= PULL_THRESHOLD_PX)
    }
    const hide = () => {
      const el = indicator.current
      if (!el) return
      el.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out'
      el.style.opacity = '0'
      el.style.transform = 'translate(-50%, 0) rotate(0deg)'
      el.dataset.armed = 'false'
    }
    const stop = () => {
      start = null
      armed = false
      hide()
    }

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      const inSheet = event.target instanceof Element && event.target.closest('[role="dialog"]') !== null
      if (latest.current.disabled || event.touches.length !== 1 || !touch || window.scrollY > 0 || inSheet) return
      start = { x: touch.clientX, y: touch.clientY }
    }
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!start || !touch) return
      const dy = touch.clientY - start.y
      // Up, sideways, or the page has moved after all: not a pull.
      if (dy <= 0 || Math.abs(touch.clientX - start.x) > dy || window.scrollY > 0) {
        stop()
        return
      }
      const distance = Math.min(PULL_MAX_PX, dy * PULL_DAMPING)
      armed = distance >= PULL_THRESHOLD_PX
      show(distance)
    }
    const onEnd = () => {
      if (start && armed) latest.current.onPull()
      stop()
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', stop, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', stop)
    }
  }, [])

  return (
    <div
      ref={indicator}
      aria-hidden="true"
      data-testid="pull-indicator"
      data-armed="false"
      className="pointer-events-none fixed left-1/2 top-[var(--top-scrim)] z-30 flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm data-[armed=true]:text-accent-text lg:hidden"
      style={{ transform: 'translate(-50%, 0)' }}
    >
      <RefreshCw size={16} strokeWidth={2.2} />
    </div>
  )
}
