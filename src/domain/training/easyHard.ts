import type { Activity } from '@/domain/activity/types'
import { round } from '@/lib/math'

/** Share of time spent in HR zones 1-2 ("easy") vs 3+ ("hard") across a set of activities. */
export function easyHardShare(activities: Activity[]): { easyPct: number | null; hardPct: number | null } {
  let easy = 0
  let total = 0
  for (const a of activities) {
    for (const z of a.hrZones) {
      total += z.seconds
      if (z.zone <= 2) easy += z.seconds
    }
  }
  if (total === 0) return { easyPct: null, hardPct: null }
  const easyPct = round((easy / total) * 100, 1)
  return { easyPct, hardPct: round(100 - easyPct) }
}
