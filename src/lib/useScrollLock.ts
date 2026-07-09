'use client'

import { useEffect } from 'react'

/**
 * Locks background scroll while a modal/sheet is open. Plain `overflow: hidden`
 * on `html`/`body` doesn't stop iOS Safari's touch-driven rubber-band scroll of
 * the page underneath, and that residual scroll is enough to trigger the
 * browser toolbar's show/hide animation - which drags every `position: fixed`
 * element (like the bottom tab bar) along with it, making it appear to jump.
 * Pinning the body at its current scroll offset blocks that scroll outright.
 */
export function useScrollLock() {
  useEffect(() => {
    const { body } = document
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
