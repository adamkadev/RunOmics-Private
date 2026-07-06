'use client'

import { useEffect } from 'react'

/** Locks page scroll while a modal/sheet is open.
 *
 * Uses the "fix the body in place" technique instead of `overflow: hidden`.
 * Toggling `overflow: hidden` on `<html>`/`<body>` lets Mobile Safari resize
 * its chrome (URL bar) mid-lock; when the lock is released the toolbar can
 * settle at a different height than before, leaving `position: fixed`
 * elements (the bottom tab bar) offset from where they started. Fixing the
 * body at its current scroll position and restoring `scrollTo` on unlock
 * keeps the viewport - and anything pinned to it - stable across the lock.
 */
export function useScrollLock() {
  useEffect(() => {
    const scrollY = window.scrollY
    const { body } = document
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      window.scrollTo(0, scrollY)
    }
  }, [])
}
