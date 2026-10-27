'use client'

import type { ShareActivity } from '@/lib/shareCardStats'
import { useRunPlace } from '@/lib/useRunPlace'

export function useShareCardGeocode(activity: ShareActivity): { locationName: string | null } {
  return { locationName: useRunPlace(activity.id, activity.route?.[0]).town }
}
