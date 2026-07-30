import { round } from '@/lib/math'

export const CTL_DAYS = 42
export const ATL_DAYS = 7

export interface LoadSnapshot {
  ctl: number
  atl: number
  tsb: number
}

export type RacePhase = 'build' | 'sharpen' | 'taper' | 'raceWeek'

const SHARPEN_FROM_DAYS = 28
const TAPER_FROM_DAYS = 14
const RACE_WEEK_DAYS = 7

export function racePhase(daysUntil: number): RacePhase {
  if (daysUntil <= RACE_WEEK_DAYS) return 'raceWeek'
  if (daysUntil <= TAPER_FROM_DAYS) return 'taper'
  if (daysUntil <= SHARPEN_FROM_DAYS) return 'sharpen'
  return 'build'
}

/**
 * Rolls CTL/ATL forward under a fixed daily load. Holding today's load flat is
 * an assumption, not a plan - the UI has to say so, because the honest answer
 * to "what will my form be" depends on training that hasn't happened yet.
 */
export function projectLoad(from: LoadSnapshot, dailyLoad: number, days: number): LoadSnapshot {
  let { ctl, atl } = from
  for (let day = 0; day < days; day++) {
    ctl += (dailyLoad - ctl) / CTL_DAYS
    atl += (dailyLoad - atl) / ATL_DAYS
  }
  return { ctl: round(ctl), atl: round(atl), tsb: round(ctl - atl) }
}

// Coggan's race-ready band: rested enough to perform, not so rested that
// fitness has started to slide.
const PEAK_TSB_MIN = 5
const PEAK_TSB_MAX = 25

export type FormVerdict = 'underRested' | 'ready' | 'overRested'

export function formVerdict(tsb: number): FormVerdict {
  if (tsb < PEAK_TSB_MIN) return 'underRested'
  if (tsb > PEAK_TSB_MAX) return 'overRested'
  return 'ready'
}
