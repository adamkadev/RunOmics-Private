'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const previouslyFocused = document.activeElement as HTMLElement | null

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
