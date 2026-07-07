import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity } from '@/domain/activity/types'
import {
  buildRouteCellSet,
  isSimilarDistance,
  routeSimilarity,
  SIMILAR_ROUTE_MIN_SIMILARITY,
  type RouteCellSet,
} from '@/lib/routeMatch'

export interface SimilarRun {
  id: string
  date: string
  durationSeconds: number
  distanceKm: number
  paceSecPerKm: number
  // 1-based position by pace among the matched runs (1 = fastest)
  rank: number
  isCurrent: boolean
}

export interface SimilarRunsData {
  // All matched passes over this route, oldest first (chart order)
  runs: SimilarRun[]
  count: number
  currentRank: number
  bestPaceSecPerKm: number
}

// Below this many passes a "progression" reads as noise, so the card is hidden.
const MIN_MATCHED_RUNS = 3

// Cell sets are derived from immutable GPS traces, so they can be cached for
// the lifetime of the process (one build / one server instance).
const cellSetCache = new Map<string, RouteCellSet>()

function cellSetFor(activity: Activity): RouteCellSet {
  let cellSet = cellSetCache.get(activity.id)
  if (!cellSet) {
    cellSet = buildRouteCellSet(activity.route ?? [])
    cellSetCache.set(activity.id, cellSet)
  }
  return cellSet
}

export function getSimilarRuns(activityId: string): SimilarRunsData | null {
  const activities = getAllActivities()
  const current = activities.find((a) => a.id === activityId)
  if (!current?.route || current.route.length < 2 || current.paceSecPerKm == null) return null

  const currentCells = cellSetFor(current)

  const matched = activities.filter((a) => {
    if (a.id === current.id) return true
    if (!a.route || a.route.length < 2 || a.paceSecPerKm == null) return false
    if (!isSimilarDistance(a.distanceKm, current.distanceKm)) return false
    return routeSimilarity(cellSetFor(a), currentCells) >= SIMILAR_ROUTE_MIN_SIMILARITY
  })

  if (matched.length < MIN_MATCHED_RUNS) return null

  const byPace = [...matched].sort((a, b) => a.paceSecPerKm! - b.paceSecPerKm!)
  const rankById = new Map(byPace.map((a, i) => [a.id, i + 1]))

  const runs: SimilarRun[] = matched
    .map((a) => ({
      id: a.id,
      date: a.date,
      durationSeconds: a.durationSeconds,
      distanceKm: a.distanceKm,
      paceSecPerKm: a.paceSecPerKm!,
      rank: rankById.get(a.id)!,
      isCurrent: a.id === current.id,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    runs,
    count: matched.length,
    currentRank: rankById.get(current.id)!,
    bestPaceSecPerKm: byPace[0]!.paceSecPerKm!,
  }
}
