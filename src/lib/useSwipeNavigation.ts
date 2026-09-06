'use client'

import { useRef } from 'react'

const SWIPE_THRESHOLD_PX = 56
const HORIZONTAL_RATIO = 2

export function useSwipeNavigation(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      start.current = null
      return
    }
    const touch = e.touches[0]
    start.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) start.current = null
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const origin = start.current
    const end = e.changedTouches[0]
    start.current = null
    if (!origin || !end) return

    const dx = end.clientX - origin.x
    const dy = end.clientY - origin.y
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return

    if (dx > 0) onPrev()
    else onNext()
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}
