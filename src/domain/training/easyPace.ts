import { median } from '@/lib/math'

/** Weeks pooled into one easy-pace reading: a single week swings with the
 *  route and the weather, four is the block the season headline compares. */
export const EASY_PACE_BLOCK_WEEKS = 4

interface EasyWeek {
  date: string
  easyPace: number | null
}

export interface EasyPaceReading {
  /** Median of the latest block of weeks with an easy run. */
  now: number
  /** Median of the first block, with the date it starts, or null under two blocks. */
  start: { pace: number; date: string } | null
}

/**
 * The one easy-pace number Analytics prints. The headline and the Easy pace
 * tile both read it, so they can't disagree (5:23 in one, 5:18 in the other,
 * because one pooled four weeks and the other took the last week alone).
 */
export function easyPaceReading(weeks: EasyWeek[], block = EASY_PACE_BLOCK_WEEKS): EasyPaceReading | null {
  const known = weeks.filter((w): w is EasyWeek & { easyPace: number } => w.easyPace !== null)
  if (!known.length) return null
  const now = median(known.slice(-block).map((w) => w.easyPace))
  const head = known.slice(0, block)
  const start = known.length >= block * 2 ? { pace: median(head.map((w) => w.easyPace)), date: head[0]!.date } : null
  return { now, start }
}
