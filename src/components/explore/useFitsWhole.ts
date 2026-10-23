'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** A change of the row's width resets it to whole, so the longer form comes back when it fits again. */
export function useFitsWhole<T extends HTMLElement>(key: string) {
  const textRef = useRef<T>(null)
  const [fit, setFit] = useState({ key, whole: true })
  // State follows props while rendering: a new text is whole again until measured.
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
