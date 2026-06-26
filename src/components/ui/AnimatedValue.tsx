'use client'

import { useCountUp } from '@/lib/useCountUp'

interface Props {
  value: number
  decimals?: number
}

export function AnimatedValue({ value, decimals = 0 }: Props) {
  const display = useCountUp(value)
  return <>{display.toFixed(decimals)}</>
}
