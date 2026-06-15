'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  decimals?: number
}

const DURATION = 700

export function AnimatedValue({ value, decimals = 0 }: Props) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = null
    const target = value

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / DURATION, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(eased * target)
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [value])

  return <>{display.toFixed(decimals)}</>
}
