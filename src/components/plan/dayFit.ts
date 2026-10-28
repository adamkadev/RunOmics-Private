import { planFit, type FitRun, type PlanFit } from '@/domain/training/planFit'
import { sessionHrCapBpm } from '@/domain/training/hrTarget'
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
