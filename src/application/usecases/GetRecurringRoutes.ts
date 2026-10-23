import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { routeCells, routeOutline, overlap, type Coord } from '@/domain/activity/routeShape'
import type { Activity } from '@/domain/activity/types'
import { distanceKm, round } from '@/lib/math'

export interface RouteRun {
  activityId: string
  date: string
  paceSecPerKm: number
}

export interface RecurringRoute {
  id: string
  /** Routes are named by place: the runs' own titles name the session, not the route. */
  start: Coord | null
  /** Its point furthest from the start, which names the route: every route from home shares its start street. */
  far: Coord | null
  /** A loop, an out-and-back that retraces itself, or a run that ends elsewhere. */
  shape: RouteShape
  runCount: number
  distanceKm: number
  outline: string
  runs: RouteRun[]
  bestPaceSecPerKm: number
  bestActivityId: string
  bestDate: string
}

export type RouteShape = 'loop' | 'out-back' | 'point'

const POINT_TO_POINT_KM = 0.4
/** Halves that share this much of their ground retrace each other. */
const RETRACE_OVERLAP = 0.6

export function farthestPoint(route: readonly Coord[]): Coord | null {
  const start = route[0]
  if (!start) return null
  let far = start
  let farKm = 0
  for (const point of route) {
    const km = distanceKm(start[0], start[1], point[0], point[1])
    if (km > farKm) {
      far = point
      farKm = km
    }
  }
  return far
}

export function routeShape(route: readonly Coord[]): RouteShape {
  const start = route[0]
  const end = route[route.length - 1]
  if (!start || !end) return 'loop'
  if (distanceKm(start[0], start[1], end[0], end[1]) > POINT_TO_POINT_KM) return 'point'
  const half = Math.floor(route.length / 2)
  const out = routeCells(route.slice(0, half))
  const back = routeCells(route.slice(half))
  return overlap(out, back) >= RETRACE_OVERLAP ? 'out-back' : 'loop'
}

const MIN_OVERLAP = 0.7

const MAX_DISTANCE_DRIFT = 0.15

const MIN_RUNS = 3

interface Cluster {
  cells: Set<string>
  runs: Activity[]
}

function sameRoute(activity: Activity, cells: Set<string>, cluster: Cluster): boolean {
  const reference = cluster.runs[0]!
  const drift = Math.abs(activity.distanceKm - reference.distanceKm) / Math.max(reference.distanceKm, 0.1)
  return drift <= MAX_DISTANCE_DRIFT && overlap(cells, cluster.cells) >= MIN_OVERLAP
}

export function clusterByRoute(activities: Activity[]): Cluster[] {
  const clusters: Cluster[] = []

  for (const activity of activities) {
    const cells = routeCells(activity.route as Coord[])
    const match = clusters.find((cluster) => sameRoute(activity, cells, cluster))
    if (match) match.runs.push(activity)
    else clusters.push({ cells, runs: [activity] })
  }

  return clusters
}

function toRecurringRoute(cluster: Cluster, index: number): RecurringRoute | null {
  const timed = cluster.runs.filter((a) => a.paceSecPerKm !== null)
  const latest = timed[0]
  if (!latest || timed.length < MIN_RUNS) return null

  const best = timed.reduce((fastest, a) => (a.paceSecPerKm! < fastest.paceSecPerKm! ? a : fastest), latest)

  const route = latest.route as Coord[]
  return {
    id: `${index}`,
    start: route[0] ?? null,
    far: farthestPoint(route),
    shape: routeShape(route),
    runCount: timed.length,
    distanceKm: round(timed.reduce((sum, a) => sum + a.distanceKm, 0) / timed.length, 1),
    outline: routeOutline(route),
    runs: [...timed].reverse().map((a) => ({
      activityId: a.id,
      date: a.date.slice(0, 10),
      paceSecPerKm: Math.round(a.paceSecPerKm!),
    })),
    bestPaceSecPerKm: Math.round(best.paceSecPerKm!),
    bestActivityId: best.id,
    bestDate: best.date.slice(0, 10),
  }
}

let cache: { source: Activity[]; routes: RecurringRoute[] } | null = null

export function getRecurringRoutes(): RecurringRoute[] {
  const source = getAllActivities()
  if (cache?.source === source) return cache.routes

  const routes = clusterByRoute(source.filter((a) => a.route && a.route.length > 1))
    .map(toRecurringRoute)
    .filter((route): route is RecurringRoute => route !== null)
    .sort((a, b) => b.runCount - a.runCount || a.distanceKm - b.distanceKm)

  cache = { source, routes }
  return routes
}
