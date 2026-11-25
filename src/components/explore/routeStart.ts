import { t } from '@/i18n'
import { formatDistance } from '@/lib/formatters'
import { distanceKm as kmBetween } from '@/lib/math'
import type { LonLat } from './workerProtocol'

export interface RouteStartState {
  /** Where the runner sets off: the tapped point, else where most runs began. */
  origin: LonLat | null
  /** No loop is asked for until there is a start. */
  waiting: boolean
  /** The start is the usual one, not a tapped point. */
  usual: boolean
}

export function routeStartState(picked: LonLat | null, usual: LonLat | null = null): RouteStartState {
  const origin = picked ?? usual
  return { origin, waiting: !origin, usual: !picked && !!usual }
}

/** "Run from Rue de la Paix", the start's street once it is named. */
export function startTitleOf(start: RouteStartState, street: string | null): string {
  const e = t.pages.map.explore
  return start.origin ? e.title(street) : e.titleWaiting
}

/** "0.6 km from home · tap the map to move the start"; null until there is a start. */
export function startLineOf(start: RouteStartState, home: LonLat | null): string | null {
  if (!start.origin) return null
  if (start.usual) return t.pages.map.explore.start.usual
  const fromHome = home ? kmBetween(home[0], home[1], start.origin[0], start.origin[1]) : null
  return t.pages.map.explore.start.line(fromHome !== null ? `${formatDistance(fromHome)} ${t.units.km}` : null)
}
