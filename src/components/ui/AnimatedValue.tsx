'use client'

import { formatKm } from '@/lib/formatters'
import { useCountUp } from '@/lib/useCountUp'

interface Props {
  value: number
  decimals?: number
  /** Thousands grouping, for counters that run past 999. */
  grouped?: boolean
}

export function AnimatedValue({ value, decimals = 0, grouped = false }: Props) {
  const display = useCountUp(value)
  return <>{grouped ? formatKm(display, decimals) : display.toFixed(decimals)}</>
}
