'use client'

import { useEffect } from 'react'

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Older iOS Safari exposes standalone this way; not in the TS lib types.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * Locks background scroll while a modal/sheet is open.
 *
 * In a regular browser tab, plain `overflow: hidden` doesn't stop iOS Safari's
 * touch-driven rubber-band scroll of the page underneath, and that residual
 * scroll is enough to trigger the browser toolbar's show/hide animation - which
 * drags every `position: fixed` element (like the bottom tab bar) along with it,
 * making it appear to jump. There we pin the body at its current scroll offset.
 *
 * In a standalone PWA there is no dynamic browser toolbar to fight, so pinning
 * the body via `position: fixed` is not only unnecessary, it actively breaks
 * layout: `top: -scrollY` + `bottom: 0` inflates the body taller than the
 * viewport once the page is scrolled, and portal'd `position: fixed` sheets can
 * end up sized/offset against that inflated box - leaving a gap under the sheet
 * and shifting the fixed tab bar (both intermittent, since they only show up
 * once scrollY > 0). A plain `overflow: hidden` lock (paired with the global
 * `overscroll-behavior-y: none` that blocks the rubber-band bounce) is enough
 * there and avoids the iOS fixed-position quirks entirely.
 */
export function useScrollLock() {
  useEffect(() => {
    const { body } = document

    if (isStandalone()) {
      const prevOverflow = body.style.overflow
      body.style.overflow = 'hidden'
      return () => {
        body.style.overflow = prevOverflow
      }
    }

    const scrollY = window.scrollY
    const prev = {
      position: body.style.position,
      top: body.style.top,
      bottom: body.style.bottom,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    // Without `bottom`, the fixed body's height collapses to its content
    // (auto) instead of spanning the viewport. On iOS Safari that shrunk box
    // can become the containing block portal'd `position: fixed` sheets size
    // against, leaving a gap between the sheet and the true screen bottom.
    body.style.bottom = '0'
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.bottom = prev.bottom
      body.style.left = prev.left
      body.style.right = prev.right
      body.style.width = prev.width
      window.scrollTo(0, scrollY)
    }
  }, [])
}
