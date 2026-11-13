import { t } from '@/i18n'
import { formatDistance } from '@/lib/formatters'
import { distanceKm as kmBetween } from '@/lib/math'
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

/** "Start: Hoenheim · 0.9 km from home"; null until the start is known. */
export function startLineOf(
  start: RouteStartState,
  target: { name: string; distanceKm?: number | null } | null,
  street: string | null,
  home: LonLat | null,
): string | null {
  const s = t.pages.map.explore.start
  const km = (value: number) => `${formatDistance(value)} ${t.units.km}`
  if (start.mode === 'quartier') return target ? s.line(target.name, target.distanceKm != null ? km(target.distanceKm) : null) : null
  if (!start.origin) return null
  const fromHome = home ? kmBetween(home[0], home[1], start.origin[0], start.origin[1]) : null
  return s.line(street ?? s.modes.pick, fromHome !== null ? km(fromHome) : null)
}
