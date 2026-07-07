'use client'

import { useEffect, useRef, useState } from 'react'
import { useHaptic } from './useHaptic'

export const PULL_THRESHOLD_PX = 64
const MAX_PULL_PX = 96
const RESISTANCE = 0.5

/**
 * Pull-down-to-refresh at the top of the page. Calls `onRefresh` once past the
 * threshold - this refreshes the current view (re-fetches already-synced server
 * data), it does not trigger a live Garmin sync, which stays on its own daily schedule.
 */
export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const crossedRef = useRef(false)
  const refreshingRef = useRef(false)
  const [pullPx, setPullPx] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const haptic = useHaptic()

  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])
  useEffect(() => { refreshingRef.current = refreshing }, [refreshing])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) { startY.current = null; return }
      startY.current = e.touches[0]?.clientY ?? null
      crossedRef.current = false
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return
      const delta = (e.touches[0]?.clientY ?? 0) - startY.current
      if (delta <= 0) { setPullPx(0); return }
      e.preventDefault()
      const damped = Math.min(MAX_PULL_PX, delta * RESISTANCE)
      setPullPx(damped)
      const crossed = damped >= PULL_THRESHOLD_PX
      if (crossed !== crossedRef.current) {
        crossedRef.current = crossed
        haptic('light')
      }
    }

    function onTouchEnd() {
      if (startY.current === null) return
      startY.current = null
      setPullPx((current) => {
        if (current >= PULL_THRESHOLD_PX) {
          setRefreshing(true)
          Promise.resolve(onRefreshRef.current()).finally(() => setRefreshing(false))
        }
        return 0
      })
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [haptic])

  return { containerRef, pullPx, refreshing }
}
