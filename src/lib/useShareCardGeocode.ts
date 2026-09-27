'use client'

import type { ShareActivity } from '@/lib/shareCardStats'
import { useRunPlace } from '@/lib/useRunPlace'

export { placeName } from '@/lib/useRunPlace'

/** The town a run started in, for the card's "Sat, Sep 26 · Hoenheim". */
export function useShareCardGeocode(activity: ShareActivity): { locationName: string | null } {
  return { locationName: useRunPlace(activity.id, activity.route?.[0]).town }
}
