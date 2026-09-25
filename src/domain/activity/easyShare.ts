import type { HrZone } from './types'
import { runTypeZone } from '@/lib/colors'

/**
 * "Easy" is one thing on every screen: time in heart-rate zones 1-2, weighted
 * by time. Volume, Intensity, Activities and Plan each worked it out their own
 * way (by run type, by the mean of monthly shares, by key sessions), so the
 * same season read 47 %, 24 %, 20 % and 0 % easy against the same guide.
 */

/**
 * The easy share the week is read against. The coaching rules treat 80 % easy
 * as a conservative ceiling on hard volume rather than a law (see the
 * coaching-plan methodology), so screens call it a guide, not a target.
 */
export const EASY_SHARE_GUIDE = 80

/** An easy/hard split in whole percent that adds up to 100. */
export interface EasyHardSplit {
  easy: number
  hard: number
}

/**
 * What goes into the share: a run's recorded zone time, or a session still to
 * run, which has no heart rate yet and counts at its type's zone for its
 * planned duration.
 */
export type EasyTimeSource = { hrZones: ReadonlyArray<Pick<HrZone, 'zone' | 'seconds'>> } | { type: string | null | undefined; seconds: number }

/** Easy and total seconds, for callers that pool before they divide. */
export function easyTime(sources: Iterable<EasyTimeSource>): { easySeconds: number; totalSeconds: number } {
  let easySeconds = 0
  let totalSeconds = 0
  for (const s of sources) {
    if ('hrZones' in s) {
      for (const z of s.hrZones) {
        totalSeconds += z.seconds
        if (z.zone <= 2) easySeconds += z.seconds
      }
    } else if (s.seconds > 0) {
      totalSeconds += s.seconds
      if (runTypeZone(s.type) <= 2) easySeconds += s.seconds
    }
  }
  return { easySeconds, totalSeconds }
}

/** Easy time from seconds already summed by zone. */
export function easyShareOfZones(zoneSeconds: Readonly<Record<number, number>>): EasyHardSplit | null {
  return easyShare([{ hrZones: Object.entries(zoneSeconds).map(([zone, seconds]) => ({ zone: Number(zone), seconds })) }])
}

/** The share of time in Z1-Z2. Null when nothing carries a zone or a duration. */
export function easyShare(sources: Iterable<EasyTimeSource>): EasyHardSplit | null {
  const { easySeconds, totalSeconds } = easyTime(sources)
  if (totalSeconds <= 0) return null
  const hard = Math.round(((totalSeconds - easySeconds) / totalSeconds) * 100)
  return { easy: 100 - hard, hard }
}
