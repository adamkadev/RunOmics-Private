'use client'

import { useCallback, useRef } from 'react'

const SWIPE_THRESHOLD_PX = 50
// Require horizontal movement to be at least 1.5x the vertical so accidental
// vertical scrolls don't trigger navigation.
const DIRECTION_RATIO = 1.5

export function useHorizontalSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX
    startY.current = e.clientY
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (startX.current === null || startY.current === null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    startX.current = null
    startY.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    if (Math.abs(dx) < Math.abs(dy) * DIRECTION_RATIO) return
    if (dx < 0) onLeft()
    else onRight()
  }, [onLeft, onRight])

  return { onPointerDown, onPointerUp }
}
