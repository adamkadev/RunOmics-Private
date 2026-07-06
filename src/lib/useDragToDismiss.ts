'use client'

import { useCallback, useRef, useState } from 'react'
import { useHaptic } from './useHaptic'

const DISMISS_THRESHOLD_PX = 80
const CLOSE_ANIMATION_MS = 220

/**
 * Drag-to-dismiss for bottom sheets. Bind `handleProps` to the drag handle (not the
 * whole sheet) so scrollable content inside the sheet keeps native scroll behavior.
 * Apply `sheetStyle` to the sheet's outer element to follow the finger while dragging.
 *
 * Past the threshold, the sheet finishes sliding off-screen under a real CSS
 * transition before `onDismiss` fires, instead of vanishing the instant the
 * finger lifts.
 */
export function useDragToDismiss(onDismiss: () => void) {
  const startY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const pastThreshold = useRef(false)
  const haptic = useHaptic()

  const triggerClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      onDismiss()
      setClosing(false)
      setDragY(0)
    }, CLOSE_ANIMATION_MS)
  }, [onDismiss])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Capture keeps all pointer events routed to this element even when the
    // pointer moves outside it, so the drag doesn't escape to page scroll.
    e.currentTarget.setPointerCapture(e.pointerId)
    startY.current = e.clientY
    setDragging(true)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (startY.current === null) return
    const y = Math.max(0, e.clientY - startY.current)
    setDragY(y)
    const crossed = y > DISMISS_THRESHOLD_PX
    if (crossed !== pastThreshold.current) {
      pastThreshold.current = crossed
      haptic('light')
    }
  }, [haptic])

  const endDrag = useCallback(() => {
    if (startY.current === null) return
    startY.current = null
    setDragging(false)
    pastThreshold.current = false
    if (dragY > DISMISS_THRESHOLD_PX) {
      triggerClose()
    } else {
      setDragY(0)
    }
  }, [dragY, triggerClose])

  return {
    // Use `close` instead of calling onDismiss directly so all close paths
    // (X button, backdrop, Escape) play the same slide-out animation as drag.
    close: triggerClose,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      style: { touchAction: 'none' as const },
    },
    // animation:'none' clears the animate-sheet-up keyframe so the closing
    // transition can take effect (CSS animations outrank transitions in cascade).
    sheetStyle: closing
      ? { animation: 'none', transform: 'translateY(100%)', transition: `transform ${CLOSE_ANIMATION_MS}ms cubic-bezier(0.32,0.72,0,1)` }
      : dragY
        ? { animation: 'none', transform: `translateY(${dragY}px)`, transition: 'none' }
        : dragging
          ? { animation: 'none', transition: 'none' }
          : undefined,
  }
}
