import type { ScoredRoute } from '@/domain/explore/types'
import type { NavigationOrigin } from '@/lib/navigation'
import type { LngLatBounds } from '@/lib/routeFrame'
import { median } from '@/lib/math'
import { ROUTE_KM_MAX, ROUTE_KM_MIN, stepKm, type ExploreFrom, type ExploreRouteParams } from './exploreHref'

/**
 * The route generator's rules (S3/S4), kept pure: which quartier, which
 * distance and pace it opens on, the seeds of each batch, what its back
 * button does, and the numbers its panel shows.
 */

/** Loops asked for at once (PLAN: N = 5, seeds base..base+4). */
export const ROUTE_BATCH = 5
/** The first batch's first seed. */
export const FIRST_SEED = 1
/** How long the stepper rests before a new distance is asked for. */
export const ROUTE_DEBOUNCE_MS = 400
/** No plan, no runs: the distance the stepper starts on. */
export const FALLBACK_ROUTE_KM = 8

/** Seeds `base` up to `base + ROUTE_BATCH − 1`. */
export function batchSeeds(base: number): number[] {
  return Array.from({ length: ROUTE_BATCH }, (_, k) => base + k)
}

/** A planned session, as the Activities page hands it over (a trimmed copy, never the coach's overview). */
export interface ExplorePlan {
  /** 'YYYY-MM-DD': the session's day. */
  date: string
  /** "Easy · 8 km + 6 strides". */
  label: string
  /** The whole session, strides and recoveries included; null when the plan gives none. */
  distanceM: number | null
  /** Duration over distance; null when either is missing. */
  paceSecPerKm: number | null
}

/**
 * The plan the generator shows and sizes the loop by: the day a Plan link
 * names (its "Find a route" is for that session), else today's; null when
 * that day has none. A link that brings a distance but no day (an older
 * one) has no plan: that distance may be any day's, and today's session
 * would lend the loop another workout's name and pace.
 */
export function generatorPlan(
  plans: readonly ExplorePlan[],
  link: Pick<ExploreRouteParams, 'date' | 'km'> | null,
  today: string | null | undefined,
): ExplorePlan | null {
  if (link && link.date == null && link.km != null) return null
  const day = link?.date ?? today
  return day ? (plans.find((plan) => plan.date === day) ?? null) : null
}

/** What the generator opens on. */
export interface GeneratorTarget {
  /** null: the next quartier. */
  unitId: string | null
  /** On the stepper's grid. */
  km: number
  /** Seconds a km for the time stat; null: unknown. */
  pace: number | null
  from: ExploreFrom | null
}

/**
 * The opening state: the link's distance and pace when it carries them
 * (Plan's "Find a route" does), else the plan's - the linked session's,
 * or today's (`generatorPlan`; decision 4: the whole session, to the nearest
 * 0.5 km) - else the athlete's median run here, else 8 km. The pace
 * likewise: the link's, the plan's, the median run's here.
 */
export function generatorTarget(
  link: Pick<ExploreRouteParams, 'quartier' | 'km' | 'pace' | 'from'> | null,
  {
    unitId = null,
    plan,
    medianKm,
    medianPace,
  }: { unitId?: string | null; plan: ExplorePlan | null; medianKm: number | null; medianPace: number | null },
): GeneratorTarget {
  const planKm = plan?.distanceM ? plan.distanceM / 1000 : null
  const km = link?.km ?? planKm ?? medianKm ?? FALLBACK_ROUTE_KM
  return {
    unitId: link?.quartier ?? unitId,
    km: stepKm(km),
    pace: link?.pace ?? plan?.paceSecPerKm ?? medianPace,
    from: link?.from ?? null,
  }
}

/** The median of the runs' distances (km) or paces (s/km) among `indices`; null without one. */
export function medianOf<T>(rows: readonly (T | undefined)[], indices: readonly number[], pick: (row: T) => number | null | undefined): number | null {
  const values = indices.flatMap((i) => {
    const row = rows[i]
    const v = row === undefined ? null : pick(row)
    return v != null && Number.isFinite(v) && v > 0 ? [v] : []
  })
  return values.length > 0 ? median(values) : null
}

/** The stepper one step (0.5 km) shorter or longer, within its bounds. */
export function stepRouteKm(km: number, direction: -1 | 1): number {
  return stepKm(km + direction * 0.5)
}

export const canStepDown = (km: number) => km > ROUTE_KM_MIN
export const canStepUp = (km: number) => km < ROUTE_KM_MAX

/** What the back button does: back through history, to a page, or the generator closes in place. */
export type GeneratorBack = { kind: 'back' } | { kind: 'push'; href: string } | { kind: 'close' }

const FROM_HREF: Record<ExploreFrom, string> = { plan: '/plan', profile: '/profile' }

/**
 * A generator opened from Plan or Progress goes back there: through history
 * when that page is the one just left (its state - Plan's day - intact),
 * else by opening it. Opened on the map, it closes in place.
 */
export function generatorBack(from: ExploreFrom | null, origin: NavigationOrigin | null): GeneratorBack {
  if (!from) return { kind: 'close' }
  const href = FROM_HREF[from]
  if (origin?.isImmediate && origin.path.split('?')[0] === href) return { kind: 'back' }
  return { kind: 'push', href }
}

/** The numbers under the stepper (S3), from the loop on screen. */
export interface RouteStats {
  distanceKm: number
  /** At the pace given; null without one. */
  timeSeconds: number | null
  /** Metres up; null when the provider gave no elevation. */
  climbM: number | null
  /** Whole per cent of the loop on new ground. */
  newPct: number
}

export function routeStats(route: ScoredRoute, paceSecPerKm: number | null): RouteStats {
  const distanceKm = route.candidate.distanceM / 1000
  const ascent = route.candidate.ascentM
  return {
    distanceKm,
    timeSeconds: paceSecPerKm != null && paceSecPerKm > 0 ? distanceKm * paceSecPerKm : null,
    climbM: ascent != null && Number.isFinite(ascent) ? Math.max(0, Math.round(ascent)) : null,
    newPct: Math.round(Math.min(1, Math.max(0, route.newShare)) * 100),
  }
}

/** The box around a loop's points; null for fewer than one usable point. */
export function lineBounds(points: readonly (readonly number[])[]): LngLatBounds | null {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of points) {
    if (lon === undefined || lat === undefined || !Number.isFinite(lon) || !Number.isFinite(lat)) continue
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return Number.isFinite(minLon) ? { minLon, minLat, maxLon, maxLat } : null
}

/** Both boxes in one; either may be missing. */
export function unionBounds(a: LngLatBounds | null, b: LngLatBounds | null): LngLatBounds | null {
  if (!a) return b
  if (!b) return a
  return {
    minLon: Math.min(a.minLon, b.minLon),
    minLat: Math.min(a.minLat, b.minLat),
    maxLon: Math.max(a.maxLon, b.maxLon),
    maxLat: Math.max(a.maxLat, b.maxLat),
  }
}
