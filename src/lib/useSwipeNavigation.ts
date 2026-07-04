'use client'

import { useRef } from 'react'

const SWIPE_THRESHOLD_PX = 40

/**
 * Horizontal swipe left/right to page through periods (weeks, months...).
 * Returns touch handlers to spread on the swipeable container. Chevron
 * buttons stay alongside as the visible/accessible affordance (desktop,
 * screen readers, discoverability); swipe is the fast path on touch.
 */
export function useSwipeNavigation(onPrev: () => void, onNext: () => void) {
  const touchStartX = useRef<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta > SWIPE_THRESHOLD_PX) onPrev()
    else if (delta < -SWIPE_THRESHOLD_PX) onNext()
  }

  return { onTouchStart, onTouchEnd }
}
