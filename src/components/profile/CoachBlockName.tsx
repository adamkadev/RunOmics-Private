'use client'

import { useCoachWords } from '@/components/coaching/useCoachWords'

/** The coach's name for the block comes from the signed-in route, never the prerendered page. */
export function CoachBlockName({ fallback, general }: { fallback: string; general: boolean }) {
  const words = useCoachWords(general)
  return <>{(general && words?.block.name) || fallback}</>
}
