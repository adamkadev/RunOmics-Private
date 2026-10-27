import { planFit, type FitRun, type PlanFit } from '@/domain/training/planFit'
import { sessionHrCapBpm } from '@/domain/training/hrTarget'
import { monthDays } from '@/domain/training/monthDays'
import { hardestType } from './weekPlanDays'
import type { PlanRun } from './planRun'
import type { PlanWorkoutView } from './planWorkoutView'

/** A day run as two runs is one session: their distance and time added, their heart rate weighted by time. */
export function combinedRun(runs: readonly PlanRun[]): FitRun | null {
  if (runs.length === 0) return null
  const timed = runs.filter((run) => run.avgHeartRate !== null && run.durationSeconds > 0)
  const timedSeconds = timed.reduce((sum, run) => sum + run.durationSeconds, 0)
  return {
    distanceKm: runs.reduce((sum, run) => sum + run.distanceKm, 0),
    durationSeconds: runs.reduce((sum, run) => sum + run.durationSeconds, 0),
    avgHeartRate: timedSeconds > 0 ? timed.reduce((sum, run) => sum + run.avgHeartRate! * run.durationSeconds, 0) / timedSeconds : null,
    type: hardestType(runs.map((run) => run.shownType)),
  }
}

export function dayFit(runs: readonly PlanRun[], workout: PlanWorkoutView | null, hrZoneBoundsBpm: readonly number[] | null): PlanFit | null {
  const run = combinedRun(runs)
  if (!run || !workout) return null
  return planFit(run, {
    distanceM: workout.distanceM,
    durationSeconds: workout.duration?.seconds ?? null,
    ...(workout.type ? { type: workout.type } : {}),
    hrCapBpm: sessionHrCapBpm(workout.hr, hrZoneBoundsBpm),
  })
}

export interface FitTally {
  asPlanned: number
  of: number
}

/** The block's sessions so far, each against the run on its day or a day either side, as the week reads them. */
export function blockFitTally(
  sessions: readonly PlanWorkoutView[],
  byDate: ReadonlyMap<string, PlanRun[]>,
  today: string,
  hrZoneBoundsBpm: readonly number[] | null,
): FitTally | null {
  const due = sessions.filter((session) => session.date < today || (byDate.get(session.date)?.length ?? 0) > 0)
  if (due.length === 0) return null
  const plannedOn = new Set(sessions.map((session) => session.date))
  const days = monthDays(
    [...new Set(due.map((session) => session.date))].sort(),
    (date) => (byDate.get(date)?.length ?? 0) > 0,
    (date) => plannedOn.has(date),
    today,
  )
  const asPlanned = due.filter((session) => {
    const day = days.get(session.date)
    const runs = byDate.get(day?.ranOn ?? session.date) ?? []
    return dayFit(runs, session, hrZoneBoundsBpm) === 'asPlanned'
  }).length
  return { asPlanned, of: due.length }
}
