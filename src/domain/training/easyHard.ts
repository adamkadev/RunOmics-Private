import type { HrZone } from '@/domain/activity/types'
import { easyTime } from '@/domain/activity/easyShare'
import { round } from '@/lib/math'

/** To one decimal, for the monthly series; the whole-percent figure screens print is easyShare(). */
export function easyHardShare(
  activities: ReadonlyArray<{ hrZones: HrZone[] }>,
): { easyPct: number | null; hardPct: number | null } {
  const { easySeconds, totalSeconds } = easyTime(activities)
  if (totalSeconds === 0) return { easyPct: null, hardPct: null }
  const easyPct = round((easySeconds / totalSeconds) * 100, 1)
  return { easyPct, hardPct: round(100 - easyPct) }
}
