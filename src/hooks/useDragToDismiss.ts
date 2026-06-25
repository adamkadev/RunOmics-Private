'use client'

import { useCallback, useRef, useState } from 'react'

const DISMISS_THRESHOLD_PX = 80

/**
 * Drag-to-dismiss for bottom sheets. Bind `handleProps` to the drag handle (not the
 * whole sheet) so scrollable content inside the sheet keeps native scroll behavior.
 * Apply `sheetStyle` to the sheet's outer element to follow the finger while dragging.
 */
export function useDragToDismiss(onDismiss: () => void) {
  const startY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startY.current = e.clientY
    setDragging(true)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (startY.current === null) return
    setDragY(Math.max(0, e.clientY - startY.current))
  }, [])

  const endDrag = useCallback(() => {
    if (startY.current === null) return
    startY.current = null
    setDragging(false)
    if (dragY > DISMISS_THRESHOLD_PX) onDismiss()
    setDragY(0)
  }, [dragY, onDismiss])

  return {
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      style: { touchAction: 'none' as const },
    },
    sheetStyle: dragY
      ? { transform: `translateY(${dragY}px)`, transition: 'none' }
      : dragging
        ? { transition: 'none' }
        : undefined,
  }
}
