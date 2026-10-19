'use client'

import { useRunPlace } from '@/lib/useRunPlace'

/**
 * "· Metz" after the type and date in the Activity title line: the town the
 * run started in (3.0), the one place rule the share card follows too - the
 * quartier read as a different place on each screen. Nothing until the
 * lookup answers; nothing without a route.
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
