'use client'

import { useEffect } from 'react'

const OWN_PINCH = '.maplibregl-map'

export function allowsPinch(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OWN_PINCH) !== null
}

/** iOS Safari ignores `user-scalable=no`, so the page cancels two-finger pinches itself. */
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
