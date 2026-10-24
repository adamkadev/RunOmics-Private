import type { LonLat } from './workerProtocol'

export type RouteStartMode = 'pick' | 'quartier'
export const ROUTE_START_MODES: readonly RouteStartMode[] = ['pick', 'quartier']

export interface RouteStartState {
  mode: RouteStartMode
  /** Where the runner sets off; null starts inside the quartier. */
  origin: LonLat | null
  /** No loop is asked for until the start is tapped. */
  waiting: boolean
}

export function routeStartState(mode: RouteStartMode, picked: LonLat | null): RouteStartState {
  if (mode === 'quartier') return { mode, origin: null, waiting: false }
  return { mode, origin: picked, waiting: !picked }
}
