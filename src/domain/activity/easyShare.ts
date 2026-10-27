import type { HrZone } from './types'
import { runTypeZone } from '@/lib/colors'

/** "Easy" is one thing on every screen: time in heart-rate zones 1-2, weighted by time. */

/** An easy/hard split in whole percent that adds up to 100. */
export interface EasyHardSplit {
  easy: number
  hard: number
}

/** A session still to run has no heart rate yet, so it counts at its type's zone for its planned duration. */
export type EasyTimeSource =
  | { hrZones: ReadonlyArray<Pick<HrZone, 'zone' | 'seconds'>> }
  /** Seconds by zone, zone 1 first, as a list row carries them. */
  | { zones: readonly number[] }
  | { type: string | null | undefined; seconds: number }

export function easyTime(sources: Iterable<EasyTimeSource>): { easySeconds: number; totalSeconds: number } {
  let easySeconds = 0
  let totalSeconds = 0
  for (const s of sources) {
    if ('hrZones' in s) {
      for (const z of s.hrZones) {
        totalSeconds += z.seconds
        if (z.zone <= 2) easySeconds += z.seconds
      }
    } else if ('zones' in s) {
      s.zones.forEach((seconds, i) => {
        totalSeconds += seconds
        if (i < 2) easySeconds += seconds
      })
    } else if (s.seconds > 0) {
      totalSeconds += s.seconds
      if (runTypeZone(s.type) <= 2) easySeconds += s.seconds
    }
  }
  return { easySeconds, totalSeconds }
}

export function easyShare(sources: Iterable<EasyTimeSource>): EasyHardSplit | null {
  const { easySeconds, totalSeconds } = easyTime(sources)
  if (totalSeconds <= 0) return null
  const hard = Math.round(((totalSeconds - easySeconds) / totalSeconds) * 100)
  return { easy: 100 - hard, hard }
}
