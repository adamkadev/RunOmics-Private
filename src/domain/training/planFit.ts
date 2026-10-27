import type { ActivityType } from '@/domain/activity/types'

export type PlanFit = 'asPlanned' | 'shorter' | 'longer' | 'harder' | 'easier'

/** Either side of the planned distance or duration that still reads as the session done as written. */
export const PLAN_FIT_TOLERANCE = 0.15

export interface FitRun {
  distanceKm: number
  durationSeconds: number
  avgHeartRate: number | null
  /** As the run is shown: the session it was set as, else the type it was given. */
  type: ActivityType
}

export interface FitSession {
  distanceM: number | null
  durationSeconds: number | null
  type?: ActivityType
  hrCapBpm: number | null
}

const isEasy = (type: ActivityType) => type === 'Base'

function lengthRatios(run: FitRun, session: FitSession): number[] {
  const ratios: number[] = []
  if (session.distanceM) ratios.push((run.distanceKm * 1_000) / session.distanceM)
  if (session.durationSeconds) ratios.push(run.durationSeconds / session.durationSeconds)
  return ratios
}

/** Harder first: an HR over the cap or a quality run on an easy day matters more than a few hundred metres. */
export function planFit(run: FitRun, session: FitSession): PlanFit {
  if (session.hrCapBpm !== null && run.avgHeartRate !== null && run.avgHeartRate > session.hrCapBpm) return 'harder'
  if (session.type && isEasy(session.type) !== isEasy(run.type)) return isEasy(session.type) ? 'harder' : 'easier'
  const ratios = lengthRatios(run, session)
  if (ratios.length === 0 || ratios.some((ratio) => Math.abs(ratio - 1) <= PLAN_FIT_TOLERANCE)) return 'asPlanned'
  return ratios[0]! < 1 ? 'shorter' : 'longer'
}
