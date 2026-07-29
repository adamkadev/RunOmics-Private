'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal accessibility for portal-based dialogs that mount only while open:
 * - marks everything else on the page `inert` (unfocusable + hidden from
 *   assistive tech) for the lifetime of the dialog,
 * - moves focus into the dialog and cycles Tab / Shift+Tab within it,
 * - restores focus to the previously focused element on close.
 *
 * Attach the returned ref to the dialog panel (not the scrim).
 */
export function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    // The dialog is portaled to <body>, so its background is every other body
    // child. Skip elements already inert (nested dialog) and scripts.
    const madeInert = Array.from(document.body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        !el.contains(container) &&
        el.tagName !== 'SCRIPT' &&
        !el.hasAttribute('inert')
    )
    madeInert.forEach((el) => el.setAttribute('inert', ''))

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))

    container.tabIndex = -1
    // Focusing the container itself (when the dialog has no focusable
    // children) is a programmatic accessibility anchor, not a keyboard-driven
    // focus - suppress its focus ring so it doesn't clash with the dialog's
    // own border/corner radius.
    container.style.outline = 'none'
    ;(focusables()[0] ?? container).focus({ preventScroll: true })

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const els = focusables()
      const first = els[0]
      const last = els[els.length - 1]
      if (!first || !last) {
        e.preventDefault()
        return
      }
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === container)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    container.addEventListener('keydown', onKeyDown)

    return () => {
      container.removeEventListener('keydown', onKeyDown)
      madeInert.forEach((el) => el.removeAttribute('inert'))
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [])

  return ref
}
