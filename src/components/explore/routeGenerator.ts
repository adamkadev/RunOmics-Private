import type { ActivityType } from '@/domain/activity/types'
import { climbPerKm, type ExploreSession, type SessionDay } from '@/domain/explore/climbBudget'
import type { ScoredRoute } from '@/domain/explore/types'
import type { NavigationOrigin } from '@/lib/navigation'
import type { LngLatBounds } from '@/lib/routeFrame'
import { appTodayIso, wallClockHour, wallClockMs } from '@/lib/calendarDate'
import { median } from '@/lib/math'
import { ROUTE_KM_MAX, ROUTE_KM_MIN, stepKm, type ExploreFrom, type ExploreRouteParams } from './exploreHref'

export const ROUTE_BATCH = 5
export const FIRST_SEED = 1
export const ROUTE_DEBOUNCE_MS = 400
export const FALLBACK_ROUTE_KM = 8
const EASY_PACE_DAYS = 56
const MIN_EASY_RUNS = 3
const DAY_MS = 86_400_000

export function batchSeeds(base: number): number[] {
  return Array.from({ length: ROUTE_BATCH }, (_, k) => base + k)
}

/** A trimmed copy, never the coach's overview. */
export interface ExplorePlan {
  /** 'YYYY-MM-DD'. */
  date: string
  /** "Easy · 8 km + 6 strides". */
  label: string
  /** The whole session, strides and recoveries included. */
  distanceM: number | null
  paceSecPerKm: number | null
  /** A quality session (reps or a tempo) wants a flat loop clear of crossings. */
  session: ExploreSession
  /** The hour the athlete usually sets off, within Garmin's scheduled part of the day; null with no run to go by. */
  hour: number | null
}

/**
 * A link that brings a distance but no day has no plan: that distance may be any day's, and today's
 * session would lend the loop another workout's name and pace.
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

/** The day the loop is for (the plan's, else today) and whether a quality session follows it. */
export function generatorDay(plans: readonly ExplorePlan[], plan: ExplorePlan | null, today: string | null | undefined): SessionDay {
  const day = plan?.date ?? today
  if (!day) return { session: plan?.session ?? null, beforeQuality: false }
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)
  return { session: plan?.session ?? null, beforeQuality: plans.some((p) => p.date === next && p.session === 'quality') }
}

/**
 * Today's loop is run now; a later day's at the athlete's usual hour, or at this hour of the day without one. Read on
 * the athlete's clock, as the panel's sunset is.
 */
export function runStart(plan: Pick<ExplorePlan, 'date' | 'hour'> | null, today: string | null, now: number): { date: string; now: number } {
  const day = today ?? appTodayIso(new Date(now))
  if (!plan || plan.date <= day) return { date: day, now }
  const timeZone = process.env.NEXT_PUBLIC_TIME_ZONE || 'Europe/Paris'
  return { date: plan.date, now: wallClockMs(plan.date, plan.hour ?? wallClockHour(now, timeZone), timeZone) }
}

export interface GeneratorTarget {
  /** null: the next quartier. */
  unitId: string | null
  km: number
  /** Seconds per km. */
  pace: number | null
  from: ExploreFrom | null
}

export function generatorTarget(
  link: Pick<ExploreRouteParams, 'quartier' | 'km' | 'pace' | 'from'> | null,
  {
    unitId = null,
    plan,
    medianKm,
    easyPace,
  }: { unitId?: string | null; plan: ExplorePlan | null; medianKm: number | null; easyPace: number | null },
): GeneratorTarget {
  const planKm = plan?.distanceM ? plan.distanceM / 1000 : null
  const km = link?.km ?? planKm ?? medianKm ?? FALLBACK_ROUTE_KM
  return {
    unitId: link?.quartier ?? unitId,
    km: stepKm(km),
    // A plan's pace is a prescription, a threshold day's averages its reps in: the loop is timed at how the athlete runs easy.
    pace: easyPace ?? link?.pace ?? plan?.paceSecPerKm ?? null,
    from: link?.from ?? null,
  }
}

export function medianOf<T>(rows: readonly (T | undefined)[], indices: readonly number[], pick: (row: T) => number | null | undefined): number | null {
  const values = indices.flatMap((i) => {
    const row = rows[i]
    const v = row === undefined ? null : pick(row)
    return v != null && Number.isFinite(v) && v > 0 ? [v] : []
  })
  return values.length > 0 ? median(values) : null
}

interface PacedRun {
  type: ActivityType
  /** 'YYYY-MM-DD' */
  date: string
  paceSecPerKm: number | null
}

/** The median of the last eight weeks' easy runs; with fewer than three, every easy run, then every run. */
export function easyPaceOf(rows: readonly (PacedRun | undefined)[], indices: readonly number[], today: string | null): number | null {
  const easy = indices.filter((i) => rows[i]?.type === 'Base')
  const since = today ? new Date(Date.parse(`${today}T00:00:00Z`) - EASY_PACE_DAYS * DAY_MS).toISOString().slice(0, 10) : null
  const recent = since ? easy.filter((i) => rows[i]!.date >= since) : easy
  const pool = recent.length >= MIN_EASY_RUNS ? recent : easy.length > 0 ? easy : indices
  return medianOf(rows, pool, (run) => run.paceSecPerKm)
}

export function stepRouteKm(km: number, direction: -1 | 1): number {
  return stepKm(km + direction * 0.5)
}

export const canStepDown = (km: number) => km > ROUTE_KM_MIN
export const canStepUp = (km: number) => km < ROUTE_KM_MAX

export type GeneratorBack = { kind: 'back' } | { kind: 'push'; href: string } | { kind: 'close' }

const FROM_HREF: Record<ExploreFrom, string> = { plan: '/plan', profile: '/profile' }

/** Back through history when that page is the one just left, so its state (Plan's day) stays intact. */
export function generatorBack(from: ExploreFrom | null, origin: NavigationOrigin | null): GeneratorBack {
  if (!from) return { kind: 'close' }
  const href = FROM_HREF[from]
  if (origin?.isImmediate && origin.path.split('?')[0] === href) return { kind: 'back' }
  return { kind: 'push', href }
}

export interface RouteStats {
  distanceKm: number
  timeSeconds: number | null
  /** null when the provider gave no elevation. */
  climbM: number | null
  /** Whole per cent of the loop on new ground. */
  newPct: number
  /** null when the provider gave no elevation. */
  climbPerKm: number | null
  /** Whole per cent of the loop on trails, soft ground or steps. */
  trailPct: number
  /** Metres climbing at 10 % or more. */
  steepClimbM: number
}

const pct = (share: number) => Math.round(Math.min(1, Math.max(0, share)) * 100)

export function routeStats(route: ScoredRoute, paceSecPerKm: number | null): RouteStats {
  const distanceKm = route.candidate.distanceM / 1000
  const ascent = route.candidate.ascentM
  return {
    distanceKm,
    timeSeconds: paceSecPerKm != null && paceSecPerKm > 0 ? distanceKm * paceSecPerKm : null,
    climbM: ascent != null && Number.isFinite(ascent) ? Math.max(0, Math.round(ascent)) : null,
    newPct: pct(route.newShare),
    climbPerKm: ascent != null && Number.isFinite(ascent) ? Math.round(climbPerKm(ascent, route.candidate.distanceM)) : null,
    trailPct: pct(route.trailShare),
    steepClimbM: Math.round(route.steepClimbM),
  }
}

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
