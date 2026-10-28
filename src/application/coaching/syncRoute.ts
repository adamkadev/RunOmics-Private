import type { GarminSyncPlan } from './garminSync'
import type { GarminSyncEntry, GarminSyncState } from './garminSyncState'
import { stableHash } from './garminSyncState'

export type WorkoutSyncRoute = 'connect' | 'intervals'

const ROUTES: readonly WorkoutSyncRoute[] = ['connect', 'intervals']

export function resolveWorkoutSyncRoute(flag: string | undefined, env: Record<string, string | undefined>): WorkoutSyncRoute {
  const hasKey = Boolean(env.INTERVALS_API_KEY?.trim())
  if (flag === undefined) return hasKey ? 'intervals' : 'connect'
  if (!ROUTES.includes(flag as WorkoutSyncRoute)) throw new Error(`--route must be one of ${ROUTES.join(', ')}`)
  if (flag === 'intervals' && !hasKey) throw new Error('--route intervals needs INTERVALS_API_KEY in the profile env file')
  return flag as WorkoutSyncRoute
}

export function intervalsAthleteId(env: Record<string, string | undefined>): string {
  return env.INTERVALS_ATHLETE_ID?.trim() || '0'
}

export function pendingConnectEntries(state: GarminSyncState, today: string): GarminSyncEntry[] {
  return state.entries.filter((entry) => entry.date >= today)
}

/** Removes RunOmics's own Connect workouts from `today` on, so the intervals.icu copies are the only ones on the watch. */
export function connectRetirementPlan(state: GarminSyncState, today: string): GarminSyncPlan {
  const operations = pendingConnectEntries(state, today).map((entry) => ({
    action: 'delete' as const,
    date: entry.date,
    title: entry.prescriptionId,
    prescriptionId: entry.prescriptionId,
    payload: null,
    contentHash: null,
    existing: entry,
    reason: 'Handed over to intervals.icu',
  }))
  const planId = state.planId ?? 'retired'
  return {
    planId,
    planRevision: 0,
    today,
    operations,
    fingerprint: stableHash({ retire: planId, operations: operations.map((operation) => operation.prescriptionId) }),
  }
}
