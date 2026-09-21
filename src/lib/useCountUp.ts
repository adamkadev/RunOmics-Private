'use client'

import { useEffect, useRef, useState } from 'react'

const DURATION = 700

/**
 * True when the viewer asked for less motion - and also when we cannot ask,
 * which covers jsdom. Counting up is decoration: a viewer who opted out, and a
 * test asserting the number, both want the final value.
 *
 * Only ever called from an effect. Calling it during render made the server
 * render the target (no matchMedia there) while the browser rendered 0, and
 * React tore the tree down on hydration.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

export function useCountUp(target: number): number {
  // null means "no animation has taken over", and renders the target. Server and
  // client therefore agree on the first paint whatever the environment allows.
  const [display, setDisplay] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    // Nothing to reset: display is already null unless an animation owns it, and
    // an animation hands it back on its last frame.
    if (prefersReducedMotion()) return

    startRef.current = null

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / DURATION, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(progress < 1 ? eased * target : null)
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [target])

  return display ?? target
}
