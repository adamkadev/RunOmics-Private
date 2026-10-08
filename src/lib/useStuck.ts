'use client'

import { useEffect, useState, type RefObject } from 'react'

/** Whether a sticky element sits at its offset, pinned there by the scroll. */
export function isStuck(el: HTMLElement): boolean {
  const offset = parseFloat(getComputedStyle(el).top)
  return window.scrollY > 0 && Number.isFinite(offset) && el.getBoundingClientRect().top <= offset + 0.5
}

/**
 * Where a sticky element would sit with nothing pinning it: just after the
 * one before it and the gap between them, in page coordinates.
 */
export function restingTop(el: HTMLElement): number {
  const before = el.previousElementSibling
  if (!before || !el.parentElement) return el.getBoundingClientRect().top + window.scrollY
  const gap = parseFloat(getComputedStyle(el.parentElement).rowGap) || 0
  return before.getBoundingClientRect().bottom + gap + window.scrollY
}

/**
 * isStuck, kept current: read on scroll and resize, and when the root's
 * style changes - the compact title bar moves the strips' offset
 * (--sticky-top) as it shows and hides.
 */
export function useStuck(ref: RefObject<HTMLElement | null>): boolean {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      if (ref.current) setStuck(isStuck(ref.current))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [ref])

  return stuck
}
