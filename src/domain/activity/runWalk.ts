import type { Activity, ActivitySplit, ActivityType, PlannedWorkout, WorkoutStep } from './types'
import { MIN_REP_SECONDS } from './sessionExecution'
import { WALK_PACE_FLOOR_SEC_PER_KM } from '@/domain/coaching/sessionDistance'
import { namedType } from '@/lib/activityTitle'

/** Past this a recovery covered next to no ground: a standing rest between intervals, not a walk. */
const STANDING_SEC_PER_KM = 1800

const RECOVERY_SPLITS: ReadonlySet<ActivitySplit['type']> = new Set(['interval_recovery', 'interval_rest'])

const stepSeconds = (step: WorkoutStep) => step.seconds ?? step.minutes * 60

/** Its run blocks, with or without a repeat group: some plans list each block on its own. */
export function runWalkBlocks(planned: PlannedWorkout | null): WorkoutStep[] {
  return planned?.steps?.filter((step) => step.kind === 'effort' && stepSeconds(step) >= MIN_REP_SECONDS) ?? []
}

function recoveriesBetweenBlocks(planned: PlannedWorkout): WorkoutStep[] {
  const steps = planned.steps ?? []
  const isBlock = (step: WorkoutStep) => step.kind === 'effort' && stepSeconds(step) >= MIN_REP_SECONDS
  const first = steps.findIndex(isBlock)
  const last = steps.findLastIndex(isBlock)
  return steps.slice(first + 1, last).filter((step) => step.kind === 'recovery')
}

const isWalkPace = (secPerKm: number) => secPerKm >= WALK_PACE_FLOOR_SEC_PER_KM && secPerKm <= STANDING_SEC_PER_KM

/** A Garmin calendar entry is typed Base when its name says nothing, so walking needs a walk-paced recovery or an easy name. */
export function isRunWalkPlan(planned: PlannedWorkout | null): boolean {
  if (!planned || (planned.type && planned.type !== 'Base')) return false
  if (runWalkBlocks(planned).length < 2) return false
  const recoveries = recoveriesBetweenBlocks(planned)
  if (!recoveries.length) return false
  return recoveries.some((step) => step.paceSecPerKm && isWalkPace(step.paceSecPerKm[0])) || namedType(planned.name) === 'Base'
}

/** Null when the run recorded no recovery to measure. */
function walkedItsRecoveries(splits: ActivitySplit[]): boolean | null {
  const recoveries = splits.filter((split) => RECOVERY_SPLITS.has(split.type) && split.durationSec > 0)
  if (!recoveries.length) return null
  const walked = recoveries.filter((split) => split.distanceM > 0 && isWalkPace((split.durationSec / split.distanceM) * 1000))
  return walked.length * 2 >= recoveries.length
}

/** The run's own type counts only when no session or plan says what the day was for: the watch can type a run/walk VO2 max. */
export function isRunWalk(
  activity: Pick<Activity, 'type' | 'splits'>,
  planned: PlannedWorkout | null,
  sessionType: ActivityType | null = null
): boolean {
  const intended = sessionType ?? (planned ? (planned.type ?? 'Base') : activity.type)
  if (intended !== 'Base') return false
  const splits = activity.splits ?? []
  const walked = walkedItsRecoveries(splits)
  if (walked === null) return isRunWalkPlan(planned)
  return walked && splits.filter((split) => split.type === 'interval_active' && split.durationSec >= MIN_REP_SECONDS).length >= 2
}
