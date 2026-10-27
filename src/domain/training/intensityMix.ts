/**
 * 80/20 is a ceiling on hard work rather than a quota:
 * too little hard is never a caution.
 */

export type IntensityStatus = 'inRange' | 'tooModerate' | 'tooHard'

/** Above this share of Z3 the time has drifted into the moderate middle. */
export const MODERATE_LIMIT_PCT = 10
/** Below this share of easy time the split is off the 80/20 guide. */
export const EASY_FLOOR_PCT = 75

export interface IntensityMix {
  easySec: number
  moderateSec: number
  hardSec: number
  totalSec: number
  easyPct: number
  moderatePct: number
  hardPct: number
  status: IntensityStatus
}

/** Seconds per heart-rate zone (1-5) as the split and its verdict; null with no zone time. */
export function intensityMix(zoneSeconds: Readonly<Partial<Record<number, number>>>): IntensityMix | null {
  const zone = (z: number) => zoneSeconds[z] ?? 0
  const easySec = zone(1) + zone(2)
  const moderateSec = zone(3)
  const hardSec = zone(4) + zone(5)
  const totalSec = easySec + moderateSec + hardSec
  if (totalSec <= 0) return null
  const easyPct = Math.round((easySec / totalSec) * 100)
  const moderatePct = Math.round((moderateSec / totalSec) * 100)
  const hardPct = 100 - easyPct - moderatePct
  const status: IntensityStatus = moderatePct > MODERATE_LIMIT_PCT ? 'tooModerate' : easyPct < EASY_FLOOR_PCT ? 'tooHard' : 'inRange'
  return { easySec, moderateSec, hardSec, totalSec, easyPct, moderatePct, hardPct, status }
}
