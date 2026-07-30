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
  runCount: number
  distanceKm: number
  /** SVG path in a 100x100 box, for the thumbnail. */
  outline: string
  /** Every pass, oldest first, so the pace over time can be read as a series. */
  runs: RouteRun[]
  bestPaceSecPerKm: number
  bestActivityId: string
  bestDate: string
}

// Same ground, allowing for an extra loop at the end.
const MIN_OVERLAP = 0.7

// Two runs of the same route rarely differ by more than a corner cut.
const MAX_DISTANCE_DRIFT = 0.15

// Below three passes there is no trend to read, only two runs side by side.
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

// Clustering compares every trace against every cluster, so cache it per server
// process the way getAllRoutes does.
let cache: RecurringRoute[] | null = null

/**
 * Routes run at least three times, with how the pace on them has moved. Same
 * ground means same hills and same distance, which is the only setting where
 * comparing raw pace across months says something about the runner.
 */
export function getRecurringRoutes(): RecurringRoute[] {
  if (cache) return cache

  // Newest first, so every cluster's first run is its most recent one.
  const withRoutes = getAllActivities().filter((a) => a.route && a.route.length > 1)

  cache = clusterByRoute(withRoutes)
    .map(toRecurringRoute)
    .filter((route): route is RecurringRoute => route !== null)
    .sort((a, b) => b.runCount - a.runCount || a.distanceKm - b.distanceKm)

  return cache
}
