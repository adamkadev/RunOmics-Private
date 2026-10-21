'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * The tab bar's press-and-drag lens (Liquid Glass v3, G2/G3/G4), from the
 * design handoff's reference hook.
 *
 * - pointerdown on the row: the platter becomes a clear lens, grows past the
 *   bar and follows the finger 1:1, clamped to the row.
 * - crossing a tab boundary fires haptic('light') once per boundary.
 * - pointerup after a drag: snaps to the tab under the finger and navigates
 *   if it changed. pointercancel: snaps back, no navigation.
 * - a plain tap (under 6 pt of travel and 250 ms) is the <Link>'s own click,
 *   exactly as before. The pointer is only captured once the finger has
 *   moved past the slop: captured from the start, the tap's click would land
 *   on the row instead of the link.
 * - prefers-reduced-motion: no lens and no follow; tap only.
 */
export const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)'
const TAP_SLOP = 6
const TAP_MS = 250

export function useTabLens(opts: {
  count: number
  activeIndex: number
  onCommit: (index: number) => void
  haptic: (kind: 'light') => void
}) {
  const { count, activeIndex, onCommit, haptic } = opts
  const rowRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; t: number; idx: number; captured: boolean } | null>(null)
  const [lens, setLens] = useState<{ x: number; idx: number } | null>(null)

  const indexAt = useCallback(
    (x: number) => {
      const w = rowRef.current?.clientWidth || 1
      return Math.min(count - 1, Math.max(0, Math.floor((x / w) * count)))
    },
    [count],
  )

  const local = (e: React.PointerEvent) => {
    const r = rowRef.current!.getBoundingClientRect()
    return Math.min(r.width, Math.max(0, e.clientX - r.left))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!rowRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const x = local(e)
    start.current = { x, t: performance.now(), idx: indexAt(x), captured: false }
    setLens({ x, idx: indexAt(x) })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const x = local(e)
    if (!s.captured && Math.abs(x - s.x) >= TAP_SLOP) {
      s.captured = true
      rowRef.current?.setPointerCapture?.(e.pointerId)
    }
    const idx = indexAt(x)
    // Once per boundary, outside the state update (an updater runs twice in StrictMode).
    if (idx !== s.idx) {
      s.idx = idx
      haptic('light')
    }
    setLens({ x, idx })
  }

  const finish = (e: React.PointerEvent, commit: boolean) => {
    const s = start.current
    start.current = null
    if (!s) return
    const x = local(e)
    const isTap = Math.abs(x - s.x) < TAP_SLOP && performance.now() - s.t < TAP_MS
    setLens(null)
    // A tap falls through to the <Link>'s own click.
    if (!commit || isTap || !s.captured) return
    const idx = indexAt(x)
    if (idx !== activeIndex) onCommit(idx)
  }

  return {
    rowRef,
    /** null at rest; { x, idx } while pressed or dragging. */
    lens,
    rowHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent) => finish(e, true),
      onPointerCancel: (e: React.PointerEvent) => finish(e, false),
    },
  }
}
