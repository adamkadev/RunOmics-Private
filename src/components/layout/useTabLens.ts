'use client'

import { useCallback, useRef, useState } from 'react'

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
    // Captured only past the slop: from the start, a tap's click would land on
    // the row instead of the link.
    if (!s.captured && Math.abs(x - s.x) >= TAP_SLOP) {
      s.captured = true
      rowRef.current?.setPointerCapture?.(e.pointerId)
    }
    const idx = indexAt(x)
    // Outside the state update: an updater runs twice in StrictMode.
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
    lens,
    rowHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent) => finish(e, true),
      onPointerCancel: (e: React.PointerEvent) => finish(e, false),
    },
  }
}
