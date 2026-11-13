import { t } from '@/i18n'
import { formatDistance } from '@/lib/formatters'
import { distanceKm as kmBetween } from '@/lib/math'
import type { LonLat } from './workerProtocol'

export interface RouteStartState {
  /** Where the runner sets off, once tapped on the map. */
  origin: LonLat | null
  /** No loop is asked for until the start is tapped. */
  waiting: boolean
}

export function routeStartState(picked: LonLat | null): RouteStartState {
  return { origin: picked, waiting: !picked }
}

/** "Run from Rue de la Paix", the start's street once it is named. */
export function startTitleOf(start: RouteStartState, street: string | null): string {
  const e = t.pages.map.explore
  return start.origin ? e.title(street) : e.titleWaiting
}

/** "0.6 km from home · tap the map to move the start"; null until the start is tapped. */
export function startLineOf(start: RouteStartState, home: LonLat | null): string | null {
  if (!start.origin) return null
  const fromHome = home ? kmBetween(home[0], home[1], start.origin[0], start.origin[1]) : null
  return t.pages.map.explore.start.line(fromHome !== null ? `${formatDistance(fromHome)} ${t.units.km}` : null)
}
