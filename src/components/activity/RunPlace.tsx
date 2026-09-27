'use client'

import { useRunPlace } from '@/lib/useRunPlace'

/**
 * "· Robertsau" after the date and type in the Activity header (v4.13.2):
 * the quartier the run started in, or its town. The small map can't name
 * it - the style only labels quartiers zoomed right in - so the header does.
 * Nothing until the lookup answers; nothing without a route.
 */
export function RunPlace({ activityId, start }: { activityId: string; start: [number, number] | null }) {
  const { town, quartier } = useRunPlace(activityId, start)
  const name = quartier ?? town
  if (!name) return null
  return (
    <>
      <span aria-hidden>·</span>
      <span data-testid="run-place">{name}</span>
    </>
  )
}
