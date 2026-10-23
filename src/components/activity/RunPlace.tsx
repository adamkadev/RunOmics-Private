'use client'

import { useRunPlace } from '@/lib/useRunPlace'

/**
 * The town the run started in: the place rule the share card follows too, so a
 * run names one place on every screen.
 */
export function RunPlace({ activityId, start }: { activityId: string; start: [number, number] | null }) {
  const { town } = useRunPlace(activityId, start)
  if (!town) return null
  return (
    <>
      <span aria-hidden>·</span>
      <span data-testid="run-place">{town}</span>
    </>
  )
}
