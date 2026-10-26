import { round } from '@/lib/math'

/**
 * Garmin's 7-day and 28-day loads for one day. Load trend, Injury risk and the
 * coach all read this one series, so a printed ratio is the last point of the
 * chart above it.
 */
export interface LoadPair {
  date: string
  acute: number
  chronic: number
}

/** The safe ratio: 0.8-1.3 × chronic, the same band as Injury risk's bar. */
export const SAFE_RATIO_LO = 0.8
export const SAFE_RATIO_HI = 1.3

interface StatusLoads {
  date: string
  acuteLoad?: number
  chronicLoad?: number
}

/** Every day with both loads, oldest first, rounded as the cards print them. */
export function loadPairs(days: StatusLoads[]): LoadPair[] {
  return days
    .filter((d) => Number.isFinite(d.acuteLoad) && Number.isFinite(d.chronicLoad) && d.chronicLoad! > 0)
    .map((d) => ({ date: d.date, acute: Math.round(d.acuteLoad!), chronic: Math.round(d.chronicLoad!) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** For a watch that sends no loads: acute the last 7 days of the app's own load, chronic its 28-day weekly average. */
export function localLoadPairs(days: ReadonlyMap<string, { load: number }>): LoadPair[] {
  const loads = [...days.values()].map((d) => d.load)
  const sum = (end: number, n: number) => loads.slice(Math.max(0, end - n + 1), end + 1).reduce((s, v) => s + v, 0)
  return loadPairs([...days.keys()].map((date, i) => ({ date, acuteLoad: sum(i, 7), chronicLoad: sum(i, 28) / 4 })))
}

export function latestLoadPair(pairs: LoadPair[]): LoadPair | null {
  return pairs.at(-1) ?? null
}

/** The day's safe range for acute load, in whole load points. */
export function safeRange(chronic: number): { lo: number; hi: number } {
  return { lo: Math.round(chronic * SAFE_RATIO_LO), hi: Math.round(chronic * SAFE_RATIO_HI) }
}

export function loadRatio(pair: LoadPair): number {
  return round(pair.acute / pair.chronic, 2)
}
