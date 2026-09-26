'use client'

import { useEffect } from 'react'

/** Elements that run their own pinch gesture: the maps zoom themselves. */
const OWN_PINCH = '.maplibregl-map'

export function allowsPinch(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OWN_PINCH) !== null
}

/**
 * No two-finger page zoom. iOS Safari ignores `user-scalable=no`, so the page
 * cancels its pinch itself: Safari's own gesture events, and any touchmove
 * with two fingers down. The maps keep their pinch, and iOS's system Zoom
 * (Settings > Accessibility) still works for anyone who needs it.
 */
export function NoPinchZoom() {
  useEffect(() => {
    const blockGesture = (event: Event) => {
      if (!allowsPinch(event.target)) event.preventDefault()
    }
    const blockTwoFingers = (event: TouchEvent) => {
      if (event.touches.length > 1 && !allowsPinch(event.target)) event.preventDefault()
    }
    const options = { passive: false } as const

    document.addEventListener('gesturestart', blockGesture, options)
    document.addEventListener('gesturechange', blockGesture, options)
    document.addEventListener('touchmove', blockTwoFingers, options)
    return () => {
      document.removeEventListener('gesturestart', blockGesture)
      document.removeEventListener('gesturechange', blockGesture)
      document.removeEventListener('touchmove', blockTwoFingers)
    }
  }, [])

  return null
}
