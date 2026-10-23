'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Whether a one-line, truncating text shows whole: true until a measure
 * finds it cut (`scrollWidth > clientWidth`), when the caller makes room -
 * a shorter wording, a word dropped beside it. Measured again before paint
 * for a new text (`key`), and whenever its row changes width (a phone
 * turned), so the longer form comes back when it fits again.
 */
export function useFitsWhole<T extends HTMLElement>(key: string) {
  const textRef = useRef<T>(null)
  const [fit, setFit] = useState({ key, whole: true })
  // A new text: whole again, to be measured (state follows props while rendering).
  if (fit.key !== key) setFit({ key, whole: true })
  const whole = fit.key === key ? fit.whole : true

  useLayoutEffect(() => {
    const el = textRef.current
    if (whole && el && el.scrollWidth > el.clientWidth) setFit({ key, whole: false })
  }, [key, whole])

  useEffect(() => {
    const row = textRef.current?.parentElement
    if (!row || typeof ResizeObserver === 'undefined') return
    let width = row.clientWidth
    const observer = new ResizeObserver(() => {
      if (row.clientWidth === width) return
      width = row.clientWidth
      setFit((prev) => (prev.whole ? prev : { ...prev, whole: true }))
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [])

  return { textRef, whole }
}
