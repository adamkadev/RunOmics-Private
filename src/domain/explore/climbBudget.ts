export type ExploreSession = 'quality' | 'long' | 'recovery' | 'easy'

export interface SessionDay {
  /** null: no session known for the day, scored as an easy run. */
  session: ExploreSession | null
  /** The next day's session is a quality one. */
  beforeQuality: boolean
}

export const NO_SESSION: SessionDay = { session: null, beforeQuality: false }

export type BudgetKind = 'quality' | 'beforeQuality' | 'recovery' | 'long' | 'easy' | 'none'

export interface ClimbBudget {
  kind: BudgetKind
  /** Metres of climb a km past which a loop scores steeply; null on a quality day, which "Flat for the reps" scores. */
  maxMPerKm: number | null
  steepDescents: boolean
}

/** [convention] m of climb per km of loop, from ORS's DEM; see docs/coaching-and-metrics.md#explore-loops. */
export const CLIMB_BUDGET_M_PER_KM = {
  beforeQuality: 12,
  recovery: 12,
  long: 15,
  easy: 20,
} as const

export function climbBudget({ session, beforeQuality }: SessionDay): ClimbBudget {
  if (session === 'quality') return { kind: 'quality', maxMPerKm: null, steepDescents: false }
  const long = session === 'long'
  if (beforeQuality) return { kind: 'beforeQuality', maxMPerKm: CLIMB_BUDGET_M_PER_KM.beforeQuality, steepDescents: long }
  if (session === 'recovery') return { kind: 'recovery', maxMPerKm: CLIMB_BUDGET_M_PER_KM.recovery, steepDescents: false }
  if (long) return { kind: 'long', maxMPerKm: CLIMB_BUDGET_M_PER_KM.long, steepDescents: true }
  return { kind: session ?? 'none', maxMPerKm: CLIMB_BUDGET_M_PER_KM.easy, steepDescents: false }
}

export function climbPerKm(climbM: number | null, distanceM: number): number {
  return climbM !== null && Number.isFinite(climbM) && distanceM > 0 ? Math.max(0, climbM) / (distanceM / 1000) : 0
}
