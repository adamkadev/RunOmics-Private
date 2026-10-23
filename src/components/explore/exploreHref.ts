/**
 * The links into Explore, and the parsing of what they carry.
 *
 * Everything lives on the Activities map (`/activities?view=map`), the one
 * map page with no glow: Plan's "Find a route" and Progress's "Explored"
 * card link straight there, never through `/map`, whose redirect drops the
 * query. The map reads these parameters once on mount and never writes them
 * on load. Kept free of heavy imports so the Plan and Progress cards can use
 * it without pulling the map in.
 */

export type ExploreFrom = 'plan' | 'profile'

export const ROUTE_KM_MIN = 2
export const ROUTE_KM_MAX = 30
export const ROUTE_KM_STEP = 0.5
/** A pace outside 2:00–15:00 a km is a parsing accident, not a plan. */
export const ROUTE_PACE_MIN = 120
export const ROUTE_PACE_MAX = 900

const UNIT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** A distance in km on the stepper's 0.5 km grid, within its bounds. */
export function stepKm(km: number): number {
  const stepped = Math.round(km / ROUTE_KM_STEP) * ROUTE_KM_STEP
  return Math.min(ROUTE_KM_MAX, Math.max(ROUTE_KM_MIN, stepped))
}

/** The whole planned session (strides and recoveries included), on the stepper's grid. */
export function planRouteKm(distanceM: number | null | undefined): number | null {
  if (distanceM == null || !Number.isFinite(distanceM) || distanceM <= 0) return null
  return stepKm(distanceM / 1000)
}

function validPace(pace: number | null | undefined): number | null {
  if (pace == null || !Number.isFinite(pace)) return null
  const whole = Math.round(pace)
  return whole >= ROUTE_PACE_MIN && whole <= ROUTE_PACE_MAX ? whole : null
}

function validUnit(id: string | null | undefined): string | null {
  return id && UNIT_ID.test(id) ? id : null
}

function validDate(date: string | null | undefined): string | null {
  return date && ISO_DATE.test(date) ? date : null
}

/** The map on Districts, optionally with one quartier's sheet open. */
export function districtsHref(quartier?: string | null): string {
  const params = new URLSearchParams({ view: 'map', layer: 'districts' })
  const unit = validUnit(quartier)
  if (unit) params.set('quartier', unit)
  return `/activities?${params.toString()}`
}

/**
 * The route generator, for a quartier (or the next one) and a distance -
 * and, from Plan, the day of the session it is for ('YYYY-MM-DD'), so the
 * generator names that session rather than today's.
 */
export function exploreRouteHref(options: {
  km?: number | null
  paceSecPerKm?: number | null
  quartier?: string | null
  date?: string | null
  from?: ExploreFrom
}): string {
  const params = new URLSearchParams({ view: 'map', explore: 'route' })
  const unit = validUnit(options.quartier)
  if (unit) params.set('quartier', unit)
  if (options.km != null && Number.isFinite(options.km)) params.set('km', String(stepKm(options.km)))
  const pace = validPace(options.paceSecPerKm)
  if (pace != null) params.set('pace', String(pace))
  const date = validDate(options.date)
  if (date) params.set('date', date)
  if (options.from) params.set('from', options.from)
  return `/activities?${params.toString()}`
}

export interface ExploreRouteParams {
  /** null: the next quartier. */
  quartier: string | null
  /** On the stepper's grid, or null for the default distance. */
  km: number | null
  /** Seconds a km, or null for the default pace. */
  pace: number | null
  /** The planned session's day, or null: today's plan, if any. */
  date: string | null
  from: ExploreFrom | null
}

/**
 * What a generator link asks for, or null when the URL does not open the
 * generator. Anything malformed falls back to its default instead of
 * failing the whole link.
 */
export function parseExploreRoute(params: {
  explore: string | null
  quartier?: string | null
  km?: string | null
  pace?: string | null
  date?: string | null
  from?: string | null
}): ExploreRouteParams | null {
  if (params.explore !== 'route') return null
  const km = params.km != null && params.km !== '' ? Number(params.km) : NaN
  const pace = params.pace != null && params.pace !== '' ? Number(params.pace) : NaN
  return {
    quartier: validUnit(params.quartier),
    km: Number.isFinite(km) && km > 0 ? stepKm(km) : null,
    pace: validPace(pace),
    date: validDate(params.date),
    from: params.from === 'plan' || params.from === 'profile' ? params.from : null,
  }
}
