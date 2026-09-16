'use client'

import { useEffect, useRef, useState } from 'react'

const DURATION = 700

/**
 * True when the viewer asked for less motion - and also when we cannot ask,
 * which covers jsdom and server rendering. Counting up is decoration: a viewer
 * who opted out of motion, and a test asserting the number, both want the final
 * value, not a frame part-way to it.
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
  // Read once: whether motion is wanted is a property of the environment, and a
  // lazy initializer keeps it out of the render path.
  const [reduced] = useState(prefersReducedMotion)
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduced) return

    startRef.current = null

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / DURATION, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(eased * target)
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [target, reduced])

  return reduced ? target : display
}
