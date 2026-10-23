'use client'

import { useEffect } from 'react'

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * A scrim at top 0 would be the fixed element iOS blurs under, so the status
 * strip dims itself (globals.css html[data-sheet-open]) while any sheet is open.
 */
let openSheets = 0
function markSheetOpen(): () => void {
  openSheets += 1
  document.documentElement.setAttribute('data-sheet-open', '')
  return () => {
    openSheets = Math.max(0, openSheets - 1)
    if (openSheets === 0) document.documentElement.removeAttribute('data-sheet-open')
  }
}

export function useScrollLock() {
  useEffect(() => {
    const unmark = markSheetOpen()
    const release = lockScroll()
    return () => {
      release()
      unmark()
    }
  }, [])
}

function lockScroll(): () => void {
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
}
