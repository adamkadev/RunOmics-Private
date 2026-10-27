'use client'

import { useRef } from 'react'

export const SWIPE_MIN_PX = 50
export const SWIPE_HORIZONTAL_RATIO = 1.5

/** A start inside one of these keeps its own horizontal gesture. */
const OWN_GESTURE = '.maplibregl-map, [data-swipe-ignore], input[type="range"]'

export type SwipeDirection = 'prev' | 'next'

/** Right is back, as a page turns. */
export function swipeDirection(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) <= SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy) * SWIPE_HORIZONTAL_RATIO) return null
  return dx > 0 ? 'prev' : 'next'
}

export function startsOwnGesture(target: EventTarget | null, root: Element): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest(OWN_GESTURE)) return true
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    const overflowX = getComputedStyle(el).overflowX
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return true
  }
  return false
}

export interface SwipeBounds {
  canPrev?: boolean
  canNext?: boolean
}

export function useSwipeNavigation(onPrev: () => void, onNext: () => void, { canPrev = true, canNext = true }: SwipeBounds = {}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  const begin = (target: EventTarget | null, root: Element, x: number, y: number) => {
    swiped.current = false
    start.current = startsOwnGesture(target, root) ? null : { x, y }
  }

  const finish = (x: number, y: number, fromMouse: boolean) => {
    const origin = start.current
    start.current = null
    if (!origin) return
    const direction = swipeDirection(x - origin.x, y - origin.y)
    if (direction === 'prev' && canPrev) onPrev()
    else if (direction === 'next' && canNext) onNext()
    else return
    swiped.current = fromMouse
  }

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (e.touches.length > 1 || !touch) start.current = null
    else begin(e.target, e.currentTarget, touch.clientX, touch.clientY)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) start.current = null
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const end = e.changedTouches[0]
    if (end) finish(end.clientX, end.clientY, false)
    else start.current = null
  }

  // Touch goes through the touch events: WebKit cancels a touch pointer as soon as the page starts to scroll.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' && e.button === 0) begin(e.target, e.currentTarget, e.clientX, e.clientY)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') finish(e.clientX, e.clientY, true)
  }

  const onPointerCancel = () => {
    start.current = null
  }

  // A mouse drag that ends over a day would also tap it.
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swiped.current) return
    swiped.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onPointerCancel, onPointerDown, onPointerUp, onPointerCancel, onClickCapture }
}
