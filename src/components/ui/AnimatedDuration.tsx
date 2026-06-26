'use client'

import { useCountUp } from '@/lib/useCountUp'

interface Props {
  seconds: number
  format: (seconds: number) => string
}

/** Count-up for duration/pace values formatted as clock strings (m:ss or h:mm). */
export function AnimatedDuration({ seconds, format }: Props) {
  const display = useCountUp(seconds)
  return <>{format(Math.round(display))}</>
}
