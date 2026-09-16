import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { routeCells, routeOutline, overlap, type Coord } from '@/domain/activity/routeShape'
import type { Activity } from '@/domain/activity/types'
import { round } from '@/lib/math'

export interface RouteRun {
  activityId: string
  date: string
  paceSecPerKm: number
}

export interface RecurringRoute {
  id: string
  /**
   * Where the route starts, for naming it after a place. The runs' own titles
   * name the session - "Seuil", "1 h endurance" - so two routes that share a
   * workout type end up sharing a name while two names for one route are a
   * coin toss.
   */
  start: Coord | null
  runCount: number
  distanceKm: number
  outline: string
  runs: RouteRun[]
  bestPaceSecPerKm: number
  bestActivityId: string
  bestDate: string
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

  return {
    id: `${index}`,
    start: (latest.route as Coord[])[0] ?? null,
    runCount: timed.length,
    distanceKm: round(timed.reduce((sum, a) => sum + a.distanceKm, 0) / timed.length, 1),
    outline: routeOutline(latest.route as Coord[]),
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

let cache: RecurringRoute[] | null = null

export function getRecurringRoutes(): RecurringRoute[] {
  if (cache) return cache

  const withRoutes = getAllActivities().filter((a) => a.route && a.route.length > 1)

  cache = clusterByRoute(withRoutes)
    .map(toRecurringRoute)
    .filter((route): route is RecurringRoute => route !== null)
    .sort((a, b) => b.runCount - a.runCount || a.distanceKm - b.distanceKm)

  return cache
}
